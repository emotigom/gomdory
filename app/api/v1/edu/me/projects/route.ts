import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readEduviewOrigin } from "@/lib/env/appConfig";

const COOKIE_NAME = "edu_anon_id";
const DEFAULT_LIMIT = 60;

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const anonId = request.cookies.get(COOKIE_NAME)?.value?.trim() ?? "";

  if (!anonId) {
    return jsonErrorWithRequestId(
      "MISSING_ANON_ID",
      "anonId cookie is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const params = request.nextUrl.searchParams;
  const boardId = params.get("boardId")?.trim() ?? "";
  const shareCode = normalizeShareCode(params.get("shareCode") ?? "");

  if (shareCode && !isLikelyShareCode(shareCode)) {
    return jsonErrorWithRequestId(
      "INVALID_SHARE_CODE",
      "shareCode is invalid",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const subject = await getRateLimitSubject(request, anonId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:me:${boardId || shareCode || "na"}:${subject}`,
        windowSeconds: 60,
        limit: 60,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          stage: "edu_rate_limited",
          action: "me_projects",
          shareCode,
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("edu_projects")
    .select("slug, title, created_at, expires_at, board_id")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_LIMIT);

  if (boardId) {
    query = query.eq("board_id", boardId);
  } else if (shareCode) {
    query = query.eq("share_code", shareCode);
  }

  const { data, error } = await query;

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_me",
          action: "fetch_failed",
          shareCode,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const publicOrigin = readEduviewOrigin();
  const projects = (data ?? []).map((project) => ({
    title: project.title,
    slug: project.slug,
    lessonId: null,
    thumbUrl: `${publicOrigin}/v1/${project.slug}/thumb.png`,
    createdAt: project.created_at,
    expiresAt: project.expires_at,
    boardId: project.board_id,
  }));

  return jsonOkWithRequestId({ projects }, requestId, withNoStoreHeaders());
}
