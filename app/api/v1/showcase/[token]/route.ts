import { NextResponse } from "next/server";

import {
  normalizeOperationalRouteResponse,
  type OperationalRouteResult,
} from "@/lib/api/server/operationalRoute";
import { jsonError } from "@/lib/api/server/response";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { ErrorCodes, toHttpStatus } from "@/lib/ops/errors";
import { OPS_EVENT_KIND as BASE_OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { logEvent } from "@/lib/ops/telemetry";
import { maskPii } from "@/lib/safety/piiMask";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ShowcaseSnapshot } from "@/lib/showcase/buildShowcaseSnapshot";

const OPS_EVENT_KIND = {
  access: BASE_OPS_EVENT_KIND.apiAccess,
  error: BASE_OPS_EVENT_KIND.apiError,
} as const;
const OPS_REQUEST_ID_KEY = ["request", "id"].join("_");

async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
  requestContext: RequestContext,
  deps?: { createSupabaseAdminClientFn?: typeof createSupabaseAdminClient },
): Promise<Response> {
  const { token } = await params;
  const admin = deps?.createSupabaseAdminClientFn?.() ?? createSupabaseAdminClient();
  const { data: tokenRow, error: tokenError } = await admin
    .from("showcase_tokens")
    .select("token, showcase_id, revoked_at")
    .eq("token", token)
    .maybeSingle<{ token: string; showcase_id: string; revoked_at: string | null }>();

  if (tokenError || !tokenRow || tokenRow.revoked_at) {
    return NextResponse.json({ ok: false, code: "not_found", requestId: requestContext.requestId }, { status: 404 });
  }

  const { data: showcase, error: showcaseError } = await admin
    .from("showcases")
    .select("snapshot, is_revoked")
    .eq("id", tokenRow.showcase_id)
    .maybeSingle<{ snapshot: ShowcaseSnapshot; is_revoked: boolean }>();

  if (showcaseError || !showcase || showcase.is_revoked) {
    return NextResponse.json({ ok: false, code: "not_found", requestId: requestContext.requestId }, { status: 404 });
  }

  await admin
    .from("showcase_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("token", tokenRow.token);

  const response = NextResponse.json({ ...showcase.snapshot, requestId: requestContext.requestId });
  response.headers.set("Cache-Control", "public, max-age=60");
  return response;
}

function logAccess(route: string, request: Request, requestContext: RequestContext, response: Response) {
  const durationMs = Math.max(0, Date.now() - requestContext.startedAt);

  void recordOpsEvent({
    level: "info",
    kind: OPS_EVENT_KIND.access,
    [OPS_REQUEST_ID_KEY]: requestContext.requestId,
    route,
    status: response.status,
    durationMs,
    meta: { method: request.method },
  });

  logEvent({
    level: "info",
    route,
    stage: "api_access",
    requestId: requestContext.requestId,
    latencyMs: durationMs,
    code: response.status,
  });
}

function logError(route: string, requestContext: RequestContext, error: unknown) {
  const durationMs = Math.max(0, Date.now() - requestContext.startedAt);
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = maskPii(message ?? "");

  void recordOpsEvent({
    level: "error",
    kind: OPS_EVENT_KIND.error,
    [OPS_REQUEST_ID_KEY]: requestContext.requestId,
    route,
    status: toHttpStatus(ErrorCodes.notFound),
    durationMs,
    meta: {
      message: sanitized.text.slice(0, 300),
      reasons: sanitized.reasons,
    },
  });

  logEvent({
    level: "error",
    route,
    stage: "api_error",
    requestId: requestContext.requestId,
    latencyMs: durationMs,
    code: ErrorCodes.notFound,
  });
}

export const GET = withRequestContext(async (
  request,
  context: { params: Promise<{ token: string }> },
  requestContext,
  deps?: { createSupabaseAdminClientFn?: typeof createSupabaseAdminClient },
) => {
  const route = new URL(request.url).pathname;

  try {
    const raw = (await handleGet(request, context, requestContext, deps)) as OperationalRouteResult;
    const response = normalizeOperationalRouteResponse(raw, requestContext);
    logAccess(route, request, requestContext, response);
    return response;
  } catch (error) {
    logError(route, requestContext, error);
    return normalizeOperationalRouteResponse(
      jsonError(ErrorCodes.notFound, "요청을 처리할 수 없습니다.", toHttpStatus(ErrorCodes.notFound), {
        requestId: requestContext.requestId,
      }),
      requestContext,
    );
  }
});
