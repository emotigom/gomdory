export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  normalizeOperationalRouteResponse,
  type OperationalRouteResult,
} from "@/lib/api/server/operationalRoute";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ErrorCodes, toHttpStatus } from "@/lib/ops/errors";
import { OPS_EVENT_KIND as BASE_OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { logEvent } from "@/lib/ops/telemetry";
import { maskPii } from "@/lib/safety/piiMask";

type LicenseListDeps = {
  requireUserApiFn?: typeof requireUserApi;
  isOpsAdminFn?: typeof isOpsAdmin;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

const OPS_EVENT_KIND = {
  access: BASE_OPS_EVENT_KIND.apiAccess,
  error: BASE_OPS_EVENT_KIND.apiError,
} as const;
const OPS_REQUEST_ID_KEY = ["request", "id"].join("_");

async function handleGet(
  _request: Request,
  _context: unknown,
  _requestContext: RequestContext,
  deps?: LicenseListDeps,
) {
  const { user } = await (deps?.requireUserApiFn ?? requireUserApi)();
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const isAdmin = (deps?.isOpsAdminFn ?? isOpsAdmin)(user.email);

  const query = admin
    .from("license_keys")
    .select("id, display_hint, uses, max_uses, expires_at, issued_to, created_at, seats, plan, created_by_user_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin) {
    query.eq("created_by_user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError("license_list_failed", "라이선스 키를 불러오지 못했습니다.", 500);
  }

  return jsonOk({
    licenses: data?.map((row) => ({
      id: row.id,
      hint: row.display_hint,
      uses: row.uses,
      maxUses: row.max_uses,
      expiresAt: row.expires_at,
      issuedTo: row.issued_to,
      createdAt: row.created_at,
      seats: row.seats,
      plan: row.plan,
      createdByUserId: row.created_by_user_id,
    })) ?? [],
  });
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
    status: toHttpStatus(ErrorCodes.dbFailed),
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
    code: ErrorCodes.dbFailed,
  });
}

export const GET = withRequestContext(async (
  request,
  context,
  requestContext,
  deps?: LicenseListDeps,
) => {
  const route = new URL(request.url).pathname;

  try {
    const raw = (await handleGet(
      request,
      context,
      requestContext,
      deps,
    )) as OperationalRouteResult;
    const response = normalizeOperationalRouteResponse(raw, requestContext);
    logAccess(route, request, requestContext, response);
    return response;
  } catch (error) {
    logError(route, requestContext, error);
    return normalizeOperationalRouteResponse(
      jsonError(
        ErrorCodes.dbFailed,
        "요청을 처리할 수 없습니다.",
        toHttpStatus(ErrorCodes.dbFailed),
        {
          requestId: requestContext.requestId,
        },
      ),
      requestContext,
    );
  }
});
