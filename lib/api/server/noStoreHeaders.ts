import "server-only";

export const NO_STORE_HEADER_VALUES = {
  "cache-control": "private, no-store, max-age=0, must-revalidate",
  pragma: "no-cache",
  vary: "Cookie, Authorization",
  "cdn-cache-control": "no-store",
} as const;

export function applyNoStoreHeaders(headers: Headers): Headers {
  headers.set("cache-control", NO_STORE_HEADER_VALUES["cache-control"]);
  headers.set("pragma", NO_STORE_HEADER_VALUES.pragma);
  headers.set("vary", NO_STORE_HEADER_VALUES.vary);
  headers.set("cdn-cache-control", NO_STORE_HEADER_VALUES["cdn-cache-control"]);
  return headers;
}

export function createNoStoreHeaders(): Headers {
  return applyNoStoreHeaders(new Headers());
}

export function mergeNoStoreHeaders(init?: HeadersInit): Headers {
  return applyNoStoreHeaders(new Headers(init));
}

export function withNoStoreHeaders(init: ResponseInit = {}): ResponseInit {
  return {
    ...init,
    headers: mergeNoStoreHeaders(init.headers),
  };
}
