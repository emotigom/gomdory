export type ErrorResponseDetails = Record<string, unknown>;

export type BuildErrorInput = {
  code: string;
  message: string;
  status?: number;
  requestId: string;
  retryable?: boolean;
  details?: ErrorResponseDetails;
};

export function buildError({
  code,
  message,
  status = 500,
  requestId,
  retryable = false,
  details,
}: BuildErrorInput): Response {
  const headers = new Headers({
    "cache-control": "no-store",
  });

  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);

  return Response.json(
    {
      ok: false,
      code,
      message,
      requestId,
      retryable,
      ...(details ? { details } : {}),
    },
    {
      status,
      headers,
    },
  );
}
