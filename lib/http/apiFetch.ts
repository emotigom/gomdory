import { assertSameOriginApi } from "./sameOrigin";
import { createRequestId, setLastRequestId } from "./requestId";
import type { ApiPath } from "@/lib/standards/pathTypes";

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

class ApiFetchError extends Error {
  code: "timeout" | "network";
  requestId?: string;

  constructor(code: "timeout" | "network", message: string, requestId?: string) {
    super(message);
    this.name = "ApiFetchError";
    this.code = code;
    this.requestId = requestId;
  }
}

export async function apiFetch(path: ApiPath, init?: ApiFetchOptions): Promise<Response> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[apiFetch] Absolute URL blocked. Use same-origin relative paths only.", path);
    }
    throw new Error("apiFetch expects a same-origin relative path.");
  }

  if (!path.startsWith("/api/")) {
    throw new Error("apiFetch expects a path that starts with /api/");
  }

  const { timeoutMs = 8000, signal, ...rest } = (init ?? {}) as ApiFetchOptions;

  if (typeof window !== "undefined") {
    if (
      process.env.NODE_ENV === "development" &&
      (path.startsWith("http://") || path.startsWith("https://"))
    ) {
      throw new Error("API requests must use same-origin relative paths in development.");
    }

    assertSameOriginApi(path, window.location.origin);
    if (process.env.NODE_ENV === "development") {
      const method = init?.method?.toUpperCase() ?? "GET";
      console.debug("[apiFetch]", method, path);
    }
  }

  const headers = new Headers(rest.headers ?? {});
  const existingRequestId = headers.get("x-client-request-id");
  const clientRequestId = existingRequestId?.trim() ? existingRequestId.trim() : createRequestId();
  if (!existingRequestId) {
    headers.set("x-client-request-id", clientRequestId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      ...rest,
      headers,
      signal: signal ?? controller.signal,
    });
    const responseRequestId = response.headers.get("x-request-id");
    setLastRequestId(responseRequestId ?? clientRequestId);
    return response;
  } catch (error) {
    const requestId = (error as { requestId?: string }).requestId ?? clientRequestId;
    const code = (error as { name?: string }).name === "AbortError" ? "timeout" : "network";
    throw new ApiFetchError(code, code === "timeout" ? "요청이 지연되었습니다." : "요청에 실패했습니다.", requestId);
  } finally {
    clearTimeout(timeout);
  }
}
