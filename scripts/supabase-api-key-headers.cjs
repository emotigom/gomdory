function assertPrivilegedSupabaseApiKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new TypeError("Supabase privileged API key is required");
  }

  if (apiKey.startsWith("sb_publishable_")) {
    throw new TypeError("Supabase privileged API key must not be publishable");
  }

  if (apiKey.startsWith("sb_") && !apiKey.startsWith("sb_secret_")) {
    throw new TypeError("Unsupported Supabase privileged API key type");
  }
}

function buildSupabaseApiKeyHeaders(apiKey, extraHeaders = {}) {
  assertPrivilegedSupabaseApiKey(apiKey);

  const isModernSecret = apiKey.startsWith("sb_secret_");
  return {
    apikey: apiKey,
    ...(!isModernSecret ? { Authorization: `Bearer ${apiKey}` } : {}),
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

module.exports = { assertPrivilegedSupabaseApiKey, buildSupabaseApiKeyHeaders };
