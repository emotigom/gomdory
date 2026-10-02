import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ViewBody = {
  slug?: string;
};

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as ViewBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const slug = payload.slug?.trim() ?? "";
  if (!slug || !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const subject = await getRateLimitSubject(request, null);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:view:${slug}:${subject}`,
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
        kind: "apiError",
        requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          stage: "edu_project_view",
          action: "rateLimited",
          slug,
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 0.02, hardLimitPerMinute: 120 },
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
  const { error } = await (
    supabase as unknown as {
      rpc: (
        fn: string,
        params: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("increment_edu_project_view", { slug_input: slug });

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "apiError",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_view",
          action: "incrementFailed",
          slug,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 0.02, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(
      "INCREMENT_FAILED",
      error.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  void recordOpsEvent(
    toSnakeKeys({
      level: "info",
      kind: "apiAccess",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_project_view",
        action: "incrementOk",
        slug,
        result: "ok",
      },
    }) as Parameters<typeof recordOpsEvent>[0],
    { sampleRate: 0.02, hardLimitPerMinute: 120 },
  );

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
