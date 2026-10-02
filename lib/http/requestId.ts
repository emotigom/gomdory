type RequestLike = Request | Headers;

function generateFallbackId() {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${timestamp}-${random}`;
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return generateFallbackId();
}

function resolveHeaders(input: RequestLike): Headers {
  if (input instanceof Headers) return input;
  return input.headers;
}

export function getOrCreateRequestId(input: RequestLike): string {
  const headers = resolveHeaders(input);
  const clientRequestId = headers.get("x-client-request-id");
  if (clientRequestId && clientRequestId.trim()) {
    return clientRequestId.trim();
  }

  const requestId = headers.get("x-request-id");
  if (requestId && requestId.trim()) {
    return requestId.trim();
  }

  return createRequestId();
}

let lastRequestId: string | null = null;

export function setLastRequestId(value: string | null | undefined) {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized) return;
  lastRequestId = normalized;
}

export function getLastRequestId(): string | null {
  return lastRequestId;
}
