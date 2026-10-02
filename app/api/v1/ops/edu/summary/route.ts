export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  isOpsAdminFn?: typeof isOpsAdmin;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

const SUMMARY_WINDOW_HOURS = 24;
const EVENTS_QUERY_LIMIT = 5000;
const TOP_SHARE_CODES_LIMIT = 5;
const RECENT_ERRORS_LIMIT = 20;

const EDU_STAGES = [
  "edu_join",
  "edu_progress",
  "edu_ai_remote",
  "edu_ai_blocked",
  "edu_publish_prepare",
  "edu_publish_commit",
  "edu_publish_blocked",
  "edu_cleanup",
  "edu_rate_limited",
] as const;

type EduStage = (typeof EDU_STAGES)[number];

type StageCounts = Record<EduStage, number>;

const initStageCounts = (): StageCounts =>
  EDU_STAGES.reduce((acc, stage) => {
    acc[stage] = 0;
    return acc;
  }, {} as StageCounts);

const isEduStage = (value: unknown): value is EduStage =>
  typeof value === "string" && (EDU_STAGES as readonly string[]).includes(value);

const toStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toNumberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const maskShareCode = (shareCode: string) => {
  if (!shareCode) return "";
  if (shareCode.length <= 4) return "••••";
  return `${shareCode.slice(0, 2)}…${shareCode.slice(-2)}`;
};

const hashShareCode = (shareCode: string) =>
  createHash("sha256").update(shareCode).digest("hex").slice(0, 8);

const buildShareCodeLabel = (shareCode: string) => {
  const masked = maskShareCode(shareCode);
  const hash = hashShareCode(shareCode);
  return { masked, hash };
};

const normalizeStage = (meta: Record<string, unknown> | null) => {
  const stage = meta?.stage;
  return isEduStage(stage) ? stage : null;
};

async function handleGet(
  _request: NextRequest,
  _context: unknown,
  requestContext: RequestContext,
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const checkOpsAdmin = deps?.isOpsAdminFn ?? isOpsAdmin;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  let userEmail: string | null = null;

  try {
    const { user } = await ensureUser();
    userEmail = user.email ?? null;
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!checkOpsAdmin(userEmail)) {
    return jsonError("not_found", "Not found", 404, { requestId: requestContext.requestId });
  }

  const client = createAdminClient();
  const sinceIso = new Date(Date.now() - SUMMARY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await client
    .from("ops_events")
    .select("id, ts, level, kind, route, request_id, status, meta")
    .gte("ts", sinceIso)
    .order("ts", { ascending: false })
    .limit(EVENTS_QUERY_LIMIT);

  if (error) {
    return jsonError("ops_events_failed", "Unable to fetch ops events", 500, {
      requestId: requestContext.requestId,
    });
  }

  const stageCounts = initStageCounts();
  const shareCodeCounts = new Map<string, number>();
  const publishResults = { success: 0, failed: 0, blocked: 0 };

  (events ?? []).forEach((row) => {
    const stage = normalizeStage(row.meta ?? null);
    if (!stage) return;

    stageCounts[stage] += 1;

    if (stage === "edu_publish_commit") {
      const result = toStringValue(row.meta?.result);
      if (result === "success") publishResults.success += 1;
      if (result === "failed") publishResults.failed += 1;
    }

    if (stage === "edu_publish_blocked") {
      publishResults.blocked += 1;
    }

    const shareCode = toStringValue(row.meta?.shareCode);
    if (shareCode) {
      shareCodeCounts.set(shareCode, (shareCodeCounts.get(shareCode) ?? 0) + 1);
    }
  });

  const topShareCodes = [...shareCodeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SHARE_CODES_LIMIT)
    .map(([shareCode, count]) => ({
      ...buildShareCodeLabel(shareCode),
      count,
    }));

  const { data: recentErrors, error: recentErrorsError } = await client
    .from("ops_events")
    .select("id, ts, level, kind, route, request_id, status, meta")
    .gte("ts", sinceIso)
    .in("level", ["error", "warn"])
    .order("ts", { ascending: false })
    .limit(RECENT_ERRORS_LIMIT);

  if (recentErrorsError) {
    console.warn("[ops/edu] failed to load recent errors", { message: recentErrorsError.message });
  }

  const recentErrorSamples = (recentErrors ?? []).map((row) => {
    const stage = normalizeStage(row.meta ?? null);
    const shareCode = toStringValue(row.meta?.shareCode);
    const masked = shareCode ? buildShareCodeLabel(shareCode).masked : null;
    return {
      id: row.id,
      ts: row.ts,
      level: row.level,
      stage,
      route: row.route,
      status: row.status,
      requestId: row.request_id,
      shareCode: masked,
      lessonId: toNumberValue(row.meta?.lessonId),
      slug: toStringValue(row.meta?.slug) || null,
      action: toStringValue(row.meta?.action) || null,
      reason: toStringValue(row.meta?.reason) || null,
      result: toStringValue(row.meta?.result) || null,
    };
  });

  return jsonOk({
    windowHours: SUMMARY_WINDOW_HOURS,
    generatedAt: new Date().toISOString(),
    stageCounts,
    publishResults,
    topShareCodes,
    recentErrors: recentErrorSamples,
  });
}

export const GET = withRequestContext(handleGet);
