import { getRuntimeEnv } from "@/lib/server/runtimeEnv";

export type OpenAiEnvSource = "cloudflare" | "process" | "missing";

export type OpenAiEnvReadResult = {
  apiKey?: string;
  envKey: "OPENAI_API_KEY" | "OPENAI_KEY" | null;
  envSource: OpenAiEnvSource;
  keyFormat: "sk" | "non_sk" | "missing";
  keyVariant: "sk_proj" | "sk_legacy" | "non_sk" | "missing";
};

export type OpenAiEnvDiagnostics = Omit<OpenAiEnvReadResult, "apiKey">;

export type OpenAiContextEnvReadResult = {
  projectId?: string;
  organizationId?: string;
  projectIdSource: OpenAiEnvSource;
  organizationIdSource: OpenAiEnvSource;
};

type OpenAiHeaderDiagnostics = {
  openaiRequestId: string | null;
  openaiOrganization: string | null;
  openaiVersion: string | null;
};

export type OpenAiUpstreamResponseDiagnostics = {
  contentType: string | null;
  server: string | null;
  cfRay: string | null;
  cfCacheStatus: string | null;
  xRequestId: string | null;
  openaiOrganization: string | null;
  openaiVersion: string | null;
};

type OpenAiContextKey = "OPENAI_PROJECT_ID" | "OPENAI_ORGANIZATION_ID";

function readOpenAiStringFromEnv(key: OpenAiContextKey | "OPENAI_API_KEY" | "OPENAI_KEY") {
  const cf = (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__;
  const env = getRuntimeEnv();
  const cfRecord = cf && typeof cf === "object" ? (cf as Record<string, unknown>) : null;
  const cfValue = cfRecord?.[key];
  if (typeof cfValue === "string" && cfValue.trim()) {
    return { value: cfValue.trim(), source: "cloudflare" as const };
  }
  const envValue = env[key];
  if (typeof envValue === "string" && envValue.trim()) {
    return { value: envValue.trim(), source: "process" as const };
  }
  return { source: "missing" as const };
}

export function readOpenAiApiKeyFromEnv(): OpenAiEnvReadResult {
  const toKeyVariant = (value: string): OpenAiEnvReadResult["keyVariant"] => {
    if (value.startsWith("sk-proj-")) return "sk_proj";
    if (value.startsWith("sk-")) return "sk_legacy";
    return "non_sk";
  };

  const primary = readOpenAiStringFromEnv("OPENAI_API_KEY");
  if (primary.value) {
    return {
      apiKey: primary.value,
      envKey: "OPENAI_API_KEY",
      envSource: primary.source,
      keyFormat: primary.value.startsWith("sk-") ? "sk" : "non_sk",
      keyVariant: toKeyVariant(primary.value),
    };
  }

  const legacy = readOpenAiStringFromEnv("OPENAI_KEY");
  if (legacy.value) {
    return {
      apiKey: legacy.value,
      envKey: "OPENAI_KEY",
      envSource: legacy.source,
      keyFormat: legacy.value.startsWith("sk-") ? "sk" : "non_sk",
      keyVariant: toKeyVariant(legacy.value),
    };
  }

  return { envKey: null, envSource: "missing", keyFormat: "missing", keyVariant: "missing" };
}

export function toOpenAiEnvDiagnostics(input: OpenAiEnvReadResult): OpenAiEnvDiagnostics {
  return {
    envKey: input.envKey,
    envSource: input.envSource,
    keyFormat: input.keyFormat,
    keyVariant: input.keyVariant,
  };
}

export function readOpenAiContextFromEnv(): OpenAiContextEnvReadResult {
  const project = readOpenAiStringFromEnv("OPENAI_PROJECT_ID");
  const organization = readOpenAiStringFromEnv("OPENAI_ORGANIZATION_ID");
  return {
    projectId: project.value,
    organizationId: organization.value,
    projectIdSource: project.source,
    organizationIdSource: organization.source,
  };
}

export function buildOpenAiAuthHeaders(apiKey: string, baseHeaders: Record<string, string> = {}) {
  const context = readOpenAiContextFromEnv();
  const headers: Record<string, string> = {
    ...baseHeaders,
    Authorization: `Bearer ${apiKey}`,
  };
  if (context.projectId) {
    headers["OpenAI-Project"] = context.projectId;
  }
  if (context.organizationId) {
    headers["OpenAI-Organization"] = context.organizationId;
  }
  return { headers, context };
}

export function getOpenAiResponseHeaderDiagnostics(response: Response): OpenAiHeaderDiagnostics {
  return {
    openaiRequestId: response.headers.get("x-request-id"),
    openaiOrganization: response.headers.get("openai-organization"),
    openaiVersion: response.headers.get("openai-version"),
  };
}

export function getOpenAiUpstreamResponseDiagnostics(response: Response): OpenAiUpstreamResponseDiagnostics {
  return {
    contentType: response.headers.get("content-type"),
    server: response.headers.get("server"),
    cfRay: response.headers.get("cf-ray"),
    cfCacheStatus: response.headers.get("cf-cache-status"),
    xRequestId: response.headers.get("x-request-id"),
    openaiOrganization: response.headers.get("openai-organization"),
    openaiVersion: response.headers.get("openai-version"),
  };
}

export function sanitizeOpenAiUpstreamBodySnippet(body: string, maxLength = 300): string {
  const sanitized = body
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9-_]+/g, "[REDACTED_KEY]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return sanitized.slice(0, maxLength);
}
