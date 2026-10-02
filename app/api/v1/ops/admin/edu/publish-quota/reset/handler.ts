import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireOpsAdmin } from "@/lib/auth/requireOpsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getKstDayRange, getKstDayRangeByDay } from "@/lib/edu/publish/quota";
import type { WithOpsContext } from "@/lib/ops/withOps";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ResetByRequestIdBody = {
  requestId: string;
  day?: string;
};

type ResetByJtNicknameBody = {
  jt: string;
  nickname: string;
  day: string;
};

type ResetPayload = Partial<ResetByRequestIdBody & ResetByJtNicknameBody>;

type Dependencies = {
  requireOpsAdminFn?: typeof requireOpsAdmin;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DB_COLUMNS = {
  publishQuotaKey: "publish_quota_key",
} as const;

function parsePayload(value: unknown): ResetPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ResetPayload;
}

export async function handleOpsAdminEduPublishQuotaReset(
  request: NextRequest,
  _context: unknown,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureOpsAdmin = deps?.requireOpsAdminFn ?? requireOpsAdmin;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  try {
    await ensureOpsAdmin(requireUserApi);
  } catch (error) {
    const status = (error as { code?: string }).code === "forbidden" ? 403 : 401;
    return jsonErrorWithRequestId(
      status === 403 ? "forbidden" : "unauthorized",
      status === 403 ? "운영자 권한이 필요합니다." : "로그인이 필요합니다.",
      ops.requestId,
      status,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let payload: ResetPayload | null = null;
  try {
    payload = parsePayload(await request.json());
  } catch {
    payload = null;
  }

  if (!payload) {
    return jsonErrorWithRequestId("invalid_body", "요청 본문이 올바르지 않습니다.", ops.requestId, 400, undefined, withNoStoreHeaders());
  }

  const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
  const jt = normalizeShareCode(typeof payload.jt === "string" ? payload.jt : "");
  const nickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  const day = typeof payload.day === "string" ? payload.day.trim() : "";

  const admin = createAdminClient();
  if (requestId) {
    const { data: row, error } = await admin
      .from("edu_projects")
      .select("publish_quota_key, last_published_at")
      .eq("last_request_id", requestId)
      .eq("publish_state", "PUBLISHED")
      .maybeSingle();

    if (error) {
      return jsonErrorWithRequestId("lookup_failed", error.message, ops.requestId, 500, undefined, withNoStoreHeaders());
    }

    const quotaKey = row?.[DB_COLUMNS.publishQuotaKey] ?? null;
    if (!quotaKey) {
      return jsonErrorWithRequestId("target_not_found", "일치하는 publish quota 대상을 찾지 못했습니다.", ops.requestId, 404, undefined, withNoStoreHeaders());
    }

    const targetDay = DAY_PATTERN.test(day) ? day : getKstDayRange(new Date(row?.last_published_at ?? Date.now())).day;
    const dayRange = getKstDayRangeByDay(targetDay);
    const { count, error: updateError } = await admin
      .from("edu_projects")
      .update({ [DB_COLUMNS.publishQuotaKey]: null }, { count: "exact" })
      .eq("publish_state", "PUBLISHED")
      .eq(DB_COLUMNS.publishQuotaKey, quotaKey)
      .gte("last_published_at", dayRange.startIso)
      .lte("last_published_at", dayRange.endIso);

    if (updateError) {
      return jsonErrorWithRequestId("reset_failed", updateError.message, ops.requestId, 500, undefined, withNoStoreHeaders());
    }

    return jsonOkWithRequestId({ resetCount: count ?? 0, day: targetDay, quotaKeys: [quotaKey], by: "requestId" }, ops.requestId, withNoStoreHeaders());
  }

  if (!isLikelyShareCode(jt) || !nickname || !DAY_PATTERN.test(day)) {
    return jsonErrorWithRequestId(
      "invalid_params",
      "requestId 또는 (jt, nickname, day[YYYY-MM-DD])가 필요합니다.",
      ops.requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const dayRange = getKstDayRangeByDay(day);
  const { data: rows, error: lookupError } = await admin
    .from("edu_projects")
    .select("publish_quota_key")
    .eq("share_code", jt)
    .eq("author_name", nickname)
    .eq("publish_state", "PUBLISHED")
    .gte("last_published_at", dayRange.startIso)
    .lte("last_published_at", dayRange.endIso);

  if (lookupError) {
    return jsonErrorWithRequestId("lookup_failed", lookupError.message, ops.requestId, 500, undefined, withNoStoreHeaders());
  }

  const quotaKeys = Array.from(new Set((rows ?? []).map((row) => row[DB_COLUMNS.publishQuotaKey]).filter((value): value is string => Boolean(value))));
  if (quotaKeys.length === 0) {
    return jsonOkWithRequestId({ resetCount: 0, day, quotaKeys: [], by: "jt+nickname" }, ops.requestId, withNoStoreHeaders());
  }

  const { count, error: updateError } = await admin
    .from("edu_projects")
    .update({ [DB_COLUMNS.publishQuotaKey]: null }, { count: "exact" })
    .eq("publish_state", "PUBLISHED")
    .in(DB_COLUMNS.publishQuotaKey, quotaKeys)
    .gte("last_published_at", dayRange.startIso)
    .lte("last_published_at", dayRange.endIso);

  if (updateError) {
    return jsonErrorWithRequestId("reset_failed", updateError.message, ops.requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ resetCount: count ?? 0, day, quotaKeys, by: "jt+nickname" }, ops.requestId, withNoStoreHeaders());
}
