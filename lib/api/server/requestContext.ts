import "server-only";

import { getOrCreateRequestId } from "@/lib/http/requestId";

export type RequestContext = {
  requestId: string;
  startedAt: number;
};

export { getOrCreateRequestId };

export function applyRequestContextHeaders(response: Response, context: RequestContext): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", context.requestId);
  const duration = Math.max(0, Date.now() - context.startedAt);
  headers.set("x-duration-ms", `${duration}`);
  headers.set("x-op-duration-ms", `${duration}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withRequestContext<
  TRequest extends Request = Request,
  TContext = unknown,
  TExtra extends unknown[] = unknown[]
>(
  handler: (
    request: TRequest,
    context: TContext,
    requestContext: RequestContext,
    ...extra: TExtra
  ) => Promise<Response>,
) {
  return async function routeHandler(request: TRequest, context: TContext, ...extra: TExtra) {
    const requestId = getOrCreateRequestId(request.headers);
    const startedAt = Date.now();
    const response = await handler(request, context, { requestId, startedAt }, ...extra);
    return applyRequestContextHeaders(response, { requestId, startedAt });
  };
}
