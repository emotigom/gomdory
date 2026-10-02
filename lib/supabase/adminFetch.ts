export type SupabaseAdminFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function assertPrivilegedSupabaseApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new TypeError("Supabase privileged API key is required");
  }

  if (apiKey.startsWith("sb_publishable_")) {
    throw new TypeError("Supabase privileged API key must not be publishable");
  }

  if (apiKey.startsWith("sb_") && !apiKey.startsWith("sb_secret_")) {
    throw new TypeError("Unsupported Supabase privileged API key type");
  }
}

export function createSupabaseAdminFetch(
  apiKey: string,
  baseFetch: SupabaseAdminFetch = fetch,
): SupabaseAdminFetch {
  assertPrivilegedSupabaseApiKey(apiKey);

  if (!apiKey.startsWith("sb_secret_")) {
    return baseFetch;
  }

  return async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (headers.get("authorization") === `Bearer ${apiKey}`) {
      headers.delete("authorization");
    }

    return baseFetch(input, { ...init, headers });
  };
}
