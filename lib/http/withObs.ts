import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api/server/response";
import type { OpsEventKind } from "@/lib/obs/eventLogger";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { applyRequestContextHeaders, getOrCreateRequestId } from "@/lib/api/server/requestContext";
import { attachTraceHeaders, startTrace, type TraceState } from "@/lib/obs/trace";

const redirectLoopRegistry = new Map<string, number>();

function getPathname(request: NextRequest) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

function trackRedirect(requestId: string, status: number) {
  if (status < 300 || status >= 400) return false;
  const current = redirectLoopRegistry.get(requestId) ?? 0;
  const next = current + 1;
  redirectLoopRegistry.set(requestId, next);
  return next >= 2;
}

export type WithObsContext = {
  params: Promise<Record<string, string>>;
};

export type WithObsHandler = (
  request: NextRequest,
  context: WithObsContext,
  trace: TraceState,
) => Promise<Response>;

export type WithObsOptions = {
  slowThresholdMs?: number;
  errorKind?: OpsEventKind;
  slowKind?: OpsEventKind;
  redirectLoopKind?: OpsEventKind;
};

export function withObs(handler: WithObsHandler, options?: WithObsOptions) {
  const {
    slowThresholdMs = 1200,
    errorKind = "api_error",
    slowKind = "api_slow",
    redirectLoopKind = "api_redirect_loop",
  } = options ?? {};

  return async function routeHandler(request: NextRequest, context: WithObsContext) {
    const requestId = getOrCreateRequestId(request.headers);
    const startedAt = Date.now();
    const trace = startTrace(requestId);
    const route = getPathname(request);

    const buildMeta = (status: number, extra?: Record<string, unknown>) => ({
      status,
      durationMs: Date.now() - startedAt,
      host: request.headers.get("host"),
      path: route,
      userType: request.headers.get("x-gom-user") ?? null,
      ...extra,
    });

    try {
      const response = await handler(request, context, trace);
      let decorated = attachTraceHeaders(response, trace);
      decorated = applyRequestContextHeaders(decorated, { requestId, startedAt });

      const durationMs = buildMeta(0).durationMs;
      if (durationMs > slowThresholdMs) {
        void recordOpsEvent({
          level: "warn",
          kind: slowKind,
          request_id: requestId,
          route,
          status: decorated.status,
          duration_ms: durationMs,
          meta: buildMeta(decorated.status),
        });
      }

      const isLoop = trackRedirect(trace.requestId, decorated.status);
      if (isLoop) {
        void recordOpsEvent({
          level: "warn",
          kind: redirectLoopKind,
          request_id: requestId,
          route,
          status: decorated.status,
          duration_ms: durationMs,
          meta: buildMeta(decorated.status, { redirectCount: 2 }),
        });
      }

      return decorated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      void recordOpsEvent({
        level: "error",
        kind: errorKind,
        request_id: requestId,
        route,
        status: 500,
        duration_ms: buildMeta(500).durationMs,
        meta: buildMeta(500, { message }),
      });

      const response = jsonError("internal_error", "서버 오류가 발생했습니다.", 500, {
        requestId,
      });
      const decorated = attachTraceHeaders(response, trace);
      return applyRequestContextHeaders(decorated, { requestId, startedAt });
    }
  };
}
