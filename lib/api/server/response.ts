import "server-only";

export type JsonData =
  | Record<string, unknown>
  | Array<unknown>
  | string
  | number
  | boolean
  | null;

export function jsonOk<T extends Record<string, unknown>>(
  data: T = {} as T,
  init?: ResponseInit,
): Response {
  return Response.json({ ok: true, ...data }, init);
}

export function jsonOkWithRequestId<T extends JsonData = Record<string, unknown>>(
  data: T = {} as T,
  requestId: string,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);

  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);
  headers.set("content-type", "application/json");

  const initWithHeaders = {
    ...init,
    headers,
  };

  const payload =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? { ok: true, requestId, ...data }
      : { ok: true, requestId, data };

  return Response.json(payload, initWithHeaders);
}

export function jsonError<T extends Record<string, unknown>>(
  code: string,
  message?: string,
  status = 400,
  extra?: T,
): Response {
  return Response.json(
    {
      ok: false,
      code,
      ...(message ? { message } : {}),
      ...(extra ?? {}),
    },
    { status },
  );
}

export function jsonErrorWithRequestId<T extends Record<string, unknown>>(
  code: string,
  message: string | undefined,
  requestId: string,
  status = 400,
  extra?: T,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);

  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);
  headers.set("content-type", "application/json");

  return Response.json(
    {
      ok: false,
      requestId,
      error: { code, message },
      ...(extra ?? {}),
    },
    { ...init, status, headers },
  );
}
