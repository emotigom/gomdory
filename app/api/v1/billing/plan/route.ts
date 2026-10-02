export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  normalizeOperationalRouteResponse,
  type OperationalRouteResult,
} from "@/lib/api/server/operationalRoute";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getUserPlan } from "@/lib/billing/getUserPlan";
import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import { ErrorCodes, toHttpStatus } from "@/lib/ops/errors";
import { OPS_EVENT_KIND as BASE_OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { logEvent } from "@/lib/ops/telemetry";
import { maskPii } from "@/lib/safety/piiMask";
import type { UserPlan } from "@/lib/types/billing";

type PlanDeps = {
  requireUserApiFn?: typeof requireUserApi;
  getUserPlanFn?: typeof getUserPlan;
  resolveEffectiveStorageQuotaFn?: typeof resolveEffectiveStorageQuota;
};

const OPS_EVENT_KIND = {
  access: BASE_OPS_EVENT_KIND.apiAccess,
  error: BASE_OPS_EVENT_KIND.apiError,
} as const;
const OPS_REQUEST_ID_KEY = ["request", "id"].join("_");

async function handleGet(_request: Request, _context: unknown, requestContext: RequestContext, deps?: PlanDeps) {
  try {
    const { user } = await (deps?.requireUserApiFn ?? requireUserApi)();
    const plan = deps?.getUserPlanFn
      ? await deps.getUserPlanFn({ userId: user.id })
      : await (async (): Promise<UserPlan> => {
          const effectiveQuota = await (deps?.resolveEffectiveStorageQuotaFn ?? resolveEffectiveStorageQuota)(user.id);
          return {
            plan: effectiveQuota.plan.plan,
            isPro: effectiveQuota.plan.plan === "pro",
            expiresAt: effectiveQuota.plan.expiresAt,
          };
        })();
    return jsonOk({ plan, requestId: requestContext.requestId });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    const status = unauthorized ? 401 : 502;
    const code = unauthorized ? "unauthorized" : "plan_lookup_failed";
    return jsonError(code, unauthorized ? "로그인이 필요합니다." : "플랜 정보를 불러오지 못했습니다.", status, {
      requestId: requestContext.requestId,
    });
  }
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

function logError(route: string, requestContext: RequestContext, errorCode: typeof ErrorCodes.dbFailed, error: unknown) {
  const durationMs = Math.max(0, Date.now() - requestContext.startedAt);
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = maskPii(message ?? "");

  void recordOpsEvent({
    level: "error",
    kind: OPS_EVENT_KIND.error,
    [OPS_REQUEST_ID_KEY]: requestContext.requestId,
    route,
    status: toHttpStatus(errorCode),
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
    code: errorCode,
  });
}

export const GET = withRequestContext(async (request, context, requestContext, deps?: PlanDeps) => {
  const route = new URL(request.url).pathname;

  try {
    const raw = (await handleGet(request, context, requestContext, deps)) as OperationalRouteResult;
    const response = normalizeOperationalRouteResponse(raw, requestContext);
    logAccess(route, request, requestContext, response);
    return response;
  } catch (error) {
    logError(route, requestContext, ErrorCodes.dbFailed, error);
    return normalizeOperationalRouteResponse(
      jsonError(ErrorCodes.dbFailed, "요청을 처리할 수 없습니다.", toHttpStatus(ErrorCodes.dbFailed), {
        requestId: requestContext.requestId,
      }),
      requestContext,
    );
  }
});
