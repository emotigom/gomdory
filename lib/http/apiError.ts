export type ApiErrorPayload = {
  ok: false;
  error: { code: string; message: string };
  requestId: string;
  retryAfterSeconds?: number;
};

export function buildApiErrorPayload(
  code: string,
  message: string,
  requestId: string,
  retryAfterSeconds?: number,
): ApiErrorPayload {
  return {
    ok: false,
    error: { code, message },
    requestId,
    ...(retryAfterSeconds ? { retryAfterSeconds } : null),
  };
}

export function apiErrorResponse(
  code: string,
  message: string,
  status: number,
  options: { requestId: string; retryAfterSeconds?: number; headers?: HeadersInit },
): Response {
  const payload = buildApiErrorPayload(code, message, options.requestId, options.retryAfterSeconds);
  const headers = new Headers(options.headers);
  if (options.retryAfterSeconds) {
    headers.set("Retry-After", `${options.retryAfterSeconds}`);
  }
  return Response.json(payload, { status, headers });
}
