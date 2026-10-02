import { apiV1Path } from "@/lib/standards/pathTypes";

import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/data/auditEvents";
import { getBoardByShareCode, isValidShareCode, normalizeShareCode } from "@/lib/data/share";
import { apiErrorResponse } from "@/lib/http/apiError";
import { fingerprintFromRequest } from "@/lib/http/fingerprint";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit, type ApiRateLimitOptions } from "@/lib/safety/rateLimit";
import { safeStudentText } from "@/lib/safety/safeStudentText";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const REPORT_THRESHOLD = 3;
const REPORT_WINDOW_MS = 10 * 60 * 1000;

const TARGET_TYPES = new Set(["card", "action", "clip", "template", "question"]);
const REASONS = new Set(["spam", "abuse", "pii", "other"]);

type ReportPayload = {
  targetType?: string;
  targetId?: string;
  code?: string | null;
  reason?: string;
  detail?: string | null;
  anonId?: string | null;
};

type ReportDeps = {
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  getBoardByShareCodeFn?: typeof getBoardByShareCode;
  checkRateLimitFn?: typeof checkRateLimit;
  rateLimitDb?: Parameters<typeof checkRateLimit>[0];
  fingerprintFromRequestFn?: typeof fingerprintFromRequest;
  recordAuditEventFn?: typeof recordAuditEvent;
  recordOpsEventFn?: typeof recordOpsEvent;
  nowFn?: () => number;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function handlePost(
  request: Request,
  _context: unknown,
  requestContext: RequestContext,
  deps?: ReportDeps,
) {
  const requestId = requestContext.requestId;
  const payload = (await request.json().catch(() => null)) as ReportPayload | null;

  const targetType = normalizeText(payload?.targetType);
  const targetId = normalizeText(payload?.targetId);
  const reason = normalizeText(payload?.reason);
  const codeRaw = normalizeText(payload?.code ?? null);
  const normalizedCode = codeRaw ? normalizeShareCode(codeRaw) : null;

  if (normalizedCode && !isValidShareCode(normalizedCode)) {
    return apiErrorResponse("invalid_code", "공유 코드를 확인해주세요.", 400, { requestId });
  }

  if (!targetType || !TARGET_TYPES.has(targetType)) {
    return apiErrorResponse("invalid_target", "신고 대상을 확인해주세요.", 400, { requestId });
  }

  if (!targetId) {
    return apiErrorResponse("invalid_target", "신고 대상을 확인해주세요.", 400, { requestId });
  }

  if (!reason || !REASONS.has(reason)) {
    return apiErrorResponse("invalid_reason", "신고 사유를 확인해주세요.", 400, { requestId });
  }

  const now = deps?.nowFn ? deps.nowFn() : Date.now();
  const anonIdRaw = normalizeText(payload?.anonId ?? null);
  const fingerprintFn = deps?.fingerprintFromRequestFn ?? fingerprintFromRequest;
  const fingerprint = anonIdRaw ?? (await fingerprintFn(request));

  const limiter = deps?.checkRateLimitFn ?? checkRateLimit;
  const rateLimitDb = (deps?.rateLimitDb ?? (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)()) as unknown as Parameters<
    typeof checkRateLimit
  >[0];
  const limitResult = await limiter(
    rateLimitDb,
    {
      key: `report:${fingerprint}:${targetType}`,
      windowSeconds: Math.ceil(REPORT_WINDOW_MS / 1000),
      limit: 5,
      now,
    } satisfies ApiRateLimitOptions,
  );

  if (!limitResult.ok) {
    void (deps?.recordOpsEventFn ?? recordOpsEvent)({
      level: "warn",
      kind: "api_error",
      request_id: requestId,
      route: apiV1Path("public/report"),
      status: 429,
      meta: { targetType },
    });
    return apiErrorResponse("rate_limited", "잠시 후 다시 시도해주세요.", 429, {
      requestId,
      retryAfterSeconds: limitResult.retryAfterSeconds,
    });
  }

  const detailSafe = typeof payload?.detail === "string" ? safeStudentText(payload.detail, { maxLength: 400 }) : null;
  const detail = detailSafe?.text ?? null;
  if (payload?.detail && !detail) {
    return apiErrorResponse("invalid_detail", "신고 내용을 확인해주세요.", 400, { requestId });
  }

  const adminClient = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const boardFetcher = deps?.getBoardByShareCodeFn ?? getBoardByShareCode;
  const board = normalizedCode ? await boardFetcher(normalizedCode) : null;
  const boardId = board?.id ?? null;

  const { error: insertError } = await adminClient.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    board_id: boardId,
    code: normalizedCode,
    reporter_anon_id: fingerprint,
    reporter_user_id: null,
    reason,
    detail,
  });

  if (insertError) {
    return apiErrorResponse("report_failed", "신고를 처리하지 못했습니다.", 502, { requestId });
  }

  const since = new Date(now - REPORT_WINDOW_MS).toISOString();
  const { count, error: countError } = await adminClient
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .gte("created_at", since);

  if (countError) {
    return apiErrorResponse("report_failed", "신고를 처리하지 못했습니다.", 502, { requestId });
  }

  let hidden = false;
  if ((count ?? 0) >= REPORT_THRESHOLD) {
    hidden = true;
    const hiddenAt = new Date(now).toISOString();
    const { error: hideError } = await adminClient
      .from("moderation_hides")
      .upsert(
        {
          target_type: targetType,
          target_id: targetId,
          hidden: true,
          hidden_reason: "auto_report_threshold",
          hidden_at: hiddenAt,
          hidden_by: null,
        },
        { onConflict: "target_type,target_id" },
      );

    if (!hideError && targetType === "card") {
      await adminClient
        .from("cards")
        .update({ is_hidden: true, hidden_at: hiddenAt })
        .eq("id", targetId);
    }

    if (!hideError && targetType === "action" && boardId) {
      const { data: controls } = await adminClient
        .from("board_controls")
        .select("hidden_action_ids")
        .eq("board_id", boardId)
        .maybeSingle();

      const hiddenIds = new Set((controls?.hidden_action_ids as string[] | null | undefined) ?? []);
      hiddenIds.add(targetId);
      await adminClient.from("board_controls").upsert(
        {
          board_id: boardId,
          hidden_action_ids: Array.from(hiddenIds),
          updated_at: hiddenAt,
        },
        { onConflict: "board_id" },
      );
    }
  }

  void (deps?.recordAuditEventFn ?? recordAuditEvent)({
    actorAnonId: fingerprint,
    action: "report_submitted",
    targetType,
    targetId,
    requestId,
    host: request.headers.get("host"),
    meta: {
      reason,
      flags: detailSafe?.flags ?? [],
      piiHitsCount: detailSafe?.piiHits.length ?? 0,
      hidden,
    },
  });

  if (detailSafe?.piiHits.length) {
    void (deps?.recordOpsEventFn ?? recordOpsEvent)({
      level: "warn",
      kind: "api_error",
      request_id: requestId,
      route: apiV1Path("public/report"),
      status: 200,
      meta: { piiHits: detailSafe.piiHits },
    });
  }

  return NextResponse.json({ ok: true, hidden, requestId });
}

export const POST = withRequestContext(handlePost);
