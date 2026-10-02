const API_PATH_PREFIX = "/api/";

function normalizeOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

export function assertSameOriginApi(input: string | URL, baseOrigin: string): void {
  const normalizedBase = normalizeOrigin(baseOrigin);

  const asString = typeof input === "string" ? input : input.toString();
  if (asString.startsWith(API_PATH_PREFIX)) {
    return;
  }

  let parsed: URL | null = null;
  try {
    parsed = typeof input === "string" ? new URL(input) : input;
  } catch {
    // ignore
  }

  const matchesOrigin = parsed?.origin === normalizedBase;
  const matchesPath = parsed?.pathname.startsWith(API_PATH_PREFIX);

  if (matchesOrigin && matchesPath) {
    return;
  }

  const message = `[api] cross-origin call blocked: ${asString}`;
  if (process.env.NODE_ENV === "development") {
    console.error(message);
  }

  throw new Error("API requests must target the same origin /api routes.");
}
