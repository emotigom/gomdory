import "server-only";

import { NextResponse } from "next/server";

import {
  applyRequestContextHeaders,
  getOrCreateRequestId,
  type RequestContext,
} from "@/lib/api/server/requestContext";

export type OperationalRouteContext = RequestContext;
export type OperationalRouteResult = Response | Record<string, unknown>;

export function createOperationalRouteContext(headers: Headers): OperationalRouteContext {
  return {
    requestId: getOrCreateRequestId(headers),
    startedAt: Date.now(),
  };
}

export function normalizeOperationalRouteResponse(
  result: OperationalRouteResult,
  context: OperationalRouteContext,
): Response {
  if (result instanceof Response) {
    return applyRequestContextHeaders(result, context);
  }

  const payload = {
    ok: true,
    ...result,
    requestId: (result as { requestId?: string }).requestId ?? context.requestId,
  };

  return applyRequestContextHeaders(NextResponse.json(payload), context);
}
