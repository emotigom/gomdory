import "server-only";

import { type NextRequest } from "next/server";

import { jsonError } from "@/lib/api/server/response";
import {
  createOperationalRouteContext,
  normalizeOperationalRouteResponse,
  type OperationalRouteContext,
  type OperationalRouteResult,
} from "@/lib/api/server/operationalRoute";
import { maskPii } from "@/lib/safety/piiMask";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { logEvent } from "@/lib/ops/telemetry";
import { ErrorCodes, toHttpStatus, type ErrorCode } from "./errors";

/**
 * Ops-specific adapter over the canonical shared operational route plumbing.
 *
 * Canonical owner:
 * - request-id-aware response/header shaping → `@/lib/api/server/operationalRoute`
 * - ops telemetry/error reporting → `@/lib/ops/**`
 *
 * Generic routes should prefer `withRequestContext` + `operationalRoute` instead of defaulting to `withOps`.
 * Remaining non-ops `withOps` usages live in `lib/ops/withOpsGrandfathered.ts` as explicit compatibility exceptions.
 * Keep this module focused on ops logging/reporting concerns.
 */

export type WithOpsContext = OperationalRouteContext;

type WithOpsHandler<
  TRequest extends NextRequest = NextRequest,
  TContext = unknown,
  TExtra extends unknown[] = [],
> = (
  request: TRequest,
  context: TContext,
  ops: WithOpsContext,
  ...extra: TExtra
) => Promise<OperationalRouteResult>;

type WithOpsOptions = {
  log?: boolean;
  onError?: (error: unknown) => void;
  errorCode?: ErrorCode;
};

function buildErrorResponse(
  requestId: string,
  code: ErrorCode,
  message?: string,
) {
  const status = toHttpStatus(code);
  return jsonError(code, message ?? "요청을 처리할 수 없습니다.", status, {
    requestId,
  });
}

function logServerError(
  code: ErrorCode,
  requestId: string,
  route: string,
  startedAt: number,
  error: unknown,
) {
  const durationMs = Math.max(0, Date.now() - startedAt);
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = maskPii(message ?? "");

  void recordOpsEvent({
    level: "error",
    kind: "api_error",
    request_id: requestId,
    route,
    status: toHttpStatus(code),
    duration_ms: durationMs,
    meta: {
      message: sanitized.text.slice(0, 300),
      reasons: sanitized.reasons,
    },
  });
}

export function withOps<
  TRequest extends NextRequest = NextRequest,
  TContext = unknown,
  TExtra extends unknown[] = [],
>(
  handler: WithOpsHandler<TRequest, TContext, TExtra>,
  options?: WithOpsOptions,
) {
  const {
    log = false,
    onError,
    errorCode = ErrorCodes.unknown,
  } = options ?? {};

  return async function routeHandler(
    request: TRequest,
    context: TContext,
    ...extra: TExtra
  ) {
    const requestContext = createOperationalRouteContext(request.headers);
    const { requestId, startedAt } = requestContext;
    const route = new URL(request.url).pathname;

    try {
      const raw = await handler(
        request,
        context,
        requestContext,
        ...(extra ?? []),
      );
      const response = normalizeOperationalRouteResponse(raw, requestContext);

      if (log) {
        const durationMs = Math.max(0, Date.now() - startedAt);
        void recordOpsEvent({
          level: "info",
          kind: "api_access",
          request_id: requestId,
          route,
          status: response.status,
          duration_ms: durationMs,
          meta: { method: request.method },
        });
        logEvent({
          level: "info",
          route,
          stage: "api_access",
          requestId,
          latencyMs: durationMs,
          code: response.status,
        });
      }

      return response;
    } catch (error) {
      onError?.(error);
      logServerError(errorCode, requestId, route, startedAt, error);
      logEvent({
        level: "error",
        route,
        stage: "api_error",
        requestId,
        latencyMs: Math.max(0, Date.now() - startedAt),
        code: errorCode,
      });
      const response = buildErrorResponse(requestId, errorCode);
      return normalizeOperationalRouteResponse(response, requestContext);
    }
  };
}
