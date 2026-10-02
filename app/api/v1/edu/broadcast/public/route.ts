import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

type BroadcastRow = Database["public"]["Tables"]["edu_broadcasts"]["Row"];

function mapBroadcast(row: BroadcastRow | null) {
  if (!row || !row.message) return null;
  return {
    message: row.message,
    ctaType: row.cta_type,
    ctaLabel: row.cta_label,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";

  if (!boardId) {
    return jsonErrorWithRequestId(
      "MISSING_BOARD_ID",
      "boardId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const subject = await getRateLimitSubject(request, null);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:broadcast:${boardId}:${subject}`,
        windowSeconds: 60,
        limit: 120,
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
          action: "broadcast_public",
          boardId,
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
  const { data, error } = await supabase
    .from("edu_broadcasts")
    .select("board_id, message, cta_type, cta_label, updated_at, updated_by, version")
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 500,
        meta: {
          stage: "edu_broadcast",
          action: "public_fetch_failed",
          boardId,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );
    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ broadcast: mapBroadcast(data) }, requestId, withNoStoreHeaders());
}
