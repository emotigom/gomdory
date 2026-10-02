import { decoratePlanJsonSchema } from "@/lib/edu/llm/responseSchemas";
import { getEduJoinSession } from "@/lib/edu/joinSession";
import { resolveJoinTokenFromRequest } from "@/lib/edu/joinTokenRequest";
import { validateDecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { SlotMapSummary } from "@/lib/edu/lesson/slotMap";
import { readDecorateDeterministicForced, readOpenAiDirectDisabled, readOpenAiModel, readStudentAiSafeModeEnabled } from "@/lib/env/appConfig";
import { digestHex } from "@/lib/crypto/webcrypto";
import { getClientIp } from "@/lib/http/fingerprint";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { postEduAiBackend } from "@/lib/server/eduAiBackendClient";
import { emitEduRouteJsonResponse, readEduRouteJsonBody } from "@/lib/server/eduRouteAdapterUtils";
import {
  type EduRouteAdapterContext,
  type EduRouteJsonResponseInput,
  type EduRouteResponseDraft,
} from "@/lib/server/eduRouteAdapterContracts";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { buildOpenAiAuthHeaders, getOpenAiResponseHeaderDiagnostics, readOpenAiApiKeyFromEnv } from "@/lib/server/openaiRuntime";
import { checkAndIncrement, SupabaseRateLimitStore } from "@/lib/security/rateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildDecorateBackendFallbackDiagnostics,
  buildDecorateProviderDiagnostics,
  EDU_PROVIDER_LABEL,
  EDU_PROVIDER_TARGET,
  type EduAiProviderAttempted,
} from "@/lib/edu/providerBoundary";

type DecoratePlanRouteDeps = {
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  resolveJoinTokenFromRequestFn?: typeof resolveJoinTokenFromRequest;
  getEduJoinSessionFn?: typeof getEduJoinSession;
  checkAndIncrementFn?: typeof checkAndIncrement;
  fetchFn?: typeof fetch;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const PLAN_TIMEOUT_MS = 15_000;
const RATE_LIMIT_USER_MINUTE = 10;
const RATE_LIMIT_USER_HOUR = 100;
const RATE_LIMIT_IP_MINUTE = 30;
const CACHE_SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_NEGATIVE_TTL_MS = 30 * 1000;
const MAX_PROMPT_LENGTH = 500;
const MAX_SNAPSHOT_LENGTH = 128;
const MAX_SLOT_FINGERPRINT_LENGTH = 256;
const MAX_SLOT_HINTS_LENGTH = 8000;

const PROMPT_BANNED_TOKEN_REGEX = /(javascript:|<\s*script\b|on\w+\s*=|https?:\/\/|bit\.ly|tinyurl|phish|credential)/i;

const SAFE_FALLBACK_PLAN = {
  version: 1,
  summary: "요청 안전 정책으로 인해 적용할 변경이 없어요.",
  ops: [],
} as const;

type DecoratePlanRequest = {
  prompt?: string;
  snapshotVersion?: string;
  slotFingerprint?: string;
  slotHints?: SlotMapSummary;
  changedNodesCount?: number;
};

type DecorateNormalizedRequest = {
  prompt: string;
  snapshotVersion: string;
  slotFingerprint: string;
  slotHintsRaw: SlotMapSummary | null;
  slotHintsString: string;
  changedNodesCount: number;
};

type CacheRow = {
  expires_at: string;
  plan_json: unknown;
  meta: unknown;
};

type CachePayload = {
  key: string;
  userId: string;
  expiresAt: string;
  planJson: Record<string, unknown>;
  meta: Record<string, unknown>;
};

type SupabaseQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: CacheRow | null; error: { message?: string } | null }>;
      };
    };
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message?: string } | null }>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizePrompt = (value: string) => value.replace(/\s+/g, " ").trim();

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
};

type DecorateMappedReason =
  | "openai_auth"
  | "openai_capacity"
  | "openai_upstream_5xx"
  | "openai_network"
  | "openai_timeout"
  | "openai_bad_request"
  | "openai_status_unknown"
  | "openai_schema_invalid"
  | "route_runtime_error"
  | "route_unknown";

type DecorateProviderAttempted = EduAiProviderAttempted;

type DecorateSafeDiagnostics = {
  route: string;
  openAiEnvSource: ReturnType<typeof readOpenAiApiKeyFromEnv>["envSource"];
  openAiEnvKey: ReturnType<typeof readOpenAiApiKeyFromEnv>["envKey"];
  openAiKeyFormat: ReturnType<typeof readOpenAiApiKeyFromEnv>["keyFormat"];
  openAiKeyVariant: ReturnType<typeof readOpenAiApiKeyFromEnv>["keyVariant"];
  upstreamStatus: number | null;
  upstreamErrorType: string | null;
  mappedReason: DecorateMappedReason;
  timeoutHit: boolean;
  usedGateway: boolean;
  providerAttempted: DecorateProviderAttempted;
  reasonDetail?: string | null;
  openaiRequestId?: string | null;
  openaiOrganization?: string | null;
  openaiVersion?: string | null;
};

const buildDecorateDiagnostics = (input: {
  route: string;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
  upstreamStatus: number | null;
  upstreamErrorType: string | null;
  mappedReason: DecorateMappedReason;
  timeoutHit: boolean;
  usedGateway: boolean;
  providerAttempted: DecorateProviderAttempted;
  reasonDetail?: string | null;
  openaiRequestId?: string | null;
  openaiOrganization?: string | null;
  openaiVersion?: string | null;
}): DecorateSafeDiagnostics =>
  buildDecorateProviderDiagnostics({
    route: input.route,
    openAiEnv: input.openAiEnv,
    upstreamStatus: input.upstreamStatus,
    upstreamErrorType: input.upstreamErrorType,
    mappedReason: input.mappedReason,
    timeoutHit: input.timeoutHit,
    usedGateway: input.usedGateway,
    providerAttempted: input.providerAttempted,
    reasonDetail: input.reasonDetail,
    openaiRequestId: input.openaiRequestId,
    openaiOrganization: input.openaiOrganization,
    openaiVersion: input.openaiVersion,
  }) as DecorateSafeDiagnostics;

const classifyProviderError = (
  error: unknown,
): { mappedReason: DecorateMappedReason; code: string; status: number; timeoutHit: boolean } => {
  const isAbortError = error instanceof DOMException && error.name === "AbortError";
  if (isAbortError) {
    return { mappedReason: "openai_timeout", code: "EDU_DECORATE_TIMEOUT", status: 504, timeoutHit: true };
  }
  if (error instanceof TypeError) {
    return { mappedReason: "openai_network", code: "EDU_DECORATE_PROVIDER_NETWORK", status: 502, timeoutHit: false };
  }
  if (error instanceof Error) {
    return { mappedReason: "route_runtime_error", code: "EDU_DECORATE_PROVIDER_RUNTIME", status: 500, timeoutHit: false };
  }
  return { mappedReason: "route_unknown", code: "EDU_DECORATE_PROVIDER_ERROR", status: 500, timeoutHit: false };
};

const classifyOpenAiStatus = (status: number) => {
  if (status === 400) return { reason: "openai_bad_request", code: "EDU_DECORATE_PROVIDER_BAD_REQUEST", responseStatus: 502 } as const;
  if (status === 401 || status === 403) return { reason: "openai_auth", code: "EDU_DECORATE_PROVIDER_AUTH", responseStatus: 503 } as const;
  if (status === 408 || status === 429) return { reason: "openai_capacity", code: "EDU_DECORATE_PROVIDER_CAPACITY", responseStatus: 503 } as const;
  if (status >= 500) return { reason: "openai_upstream_5xx", code: "EDU_DECORATE_PROVIDER_UPSTREAM", responseStatus: 503 } as const;
  return { reason: "openai_status_unknown", code: "EDU_DECORATE_PROVIDER_ERROR", responseStatus: 502 } as const;
};

const logDecoratePlanServerError = (reason: string, requestId: string, meta?: Record<string, unknown>) => {
  console.warn("decorate_plan_server_error", { reason, requestId, ...(meta ?? {}) });
};

const logCacheWarning = (op: "read" | "write", requestId: string, meta?: Record<string, unknown>) => {
  console.warn("decorate_plan_cache_warning", { op, requestId, ...(meta ?? {}) });
};

const logRateLimitWarning = (requestId: string, meta?: Record<string, unknown>) => {
  console.warn("decorate_plan_rate_limit_warning", { requestId, ...(meta ?? {}) });
};

const logJoinSessionWarning = (requestId: string, meta?: Record<string, unknown>) => {
  console.warn("decorate_plan_join_session_warning", { requestId, ...(meta ?? {}) });
};

const safeCreateAdminClient = (factory: () => unknown, requestId: string): SupabaseQueryClient | null => {
  try {
    return factory() as SupabaseQueryClient;
  } catch (error) {
    logDecoratePlanServerError("admin_client_unavailable", requestId, {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
};


const safeResolveJoinSession = async (
  token: string,
  getEduJoinSessionFn: typeof getEduJoinSession,
): Promise<{ session: Awaited<ReturnType<typeof getEduJoinSession>>; state: "resolved" | "invalid" | "lookup_error" }> => {
  try {
    const session = await getEduJoinSessionFn(token);
    if (!session?.shareCode) {
      return { session: null, state: "invalid" };
    }
    return { session, state: "resolved" };
  } catch {
    return { session: null, state: "lookup_error" };
  }
};

const safeReadCacheRow = async (
  supabase: SupabaseQueryClient | null,
  key: string,
  requestId: string,
): Promise<CacheRow | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("decorate_plan_cache").select("expires_at, plan_json, meta").eq("key", key).maybeSingle();
    if (error) {
      logCacheWarning("read", requestId, { hasError: true });
      return null;
    }
    return data;
  } catch {
    logCacheWarning("read", requestId, { hasError: true });
    return null;
  }
};

const safeWriteCacheRow = async (
  cacheWritable: boolean,
  supabase: SupabaseQueryClient | null,
  requestId: string,
  params: CachePayload | null,
) => {
  if (!cacheWritable || !supabase || !params) {
    return;
  }

  try {
    const { error } = await supabase.from("decorate_plan_cache").upsert(
      {
        key: params.key,
        user_id: params.userId,
        expires_at: params.expiresAt,
        plan_json: params.planJson,
        meta: params.meta,
      },
      { onConflict: "key" },
    );
    if (error) {
      logCacheWarning("write", requestId, { hasError: true });
    }
  } catch {
    logCacheWarning("write", requestId, { hasError: true });
  }
};

const safeRateLimitCheck = async ({
  checkAndIncrementFn,
  store,
  key,
  limit,
  windowSec,
  requestId,
}: {
  checkAndIncrementFn: typeof checkAndIncrement;
  store: SupabaseRateLimitStore | null;
  key: string;
  limit: number;
  windowSec: number;
  requestId: string;
}): Promise<{ allowed: boolean; unavailable?: boolean }> => {
  if (!store) {
    logRateLimitWarning(requestId, { reason: "store_unavailable" });
    return { allowed: false, unavailable: true };
  }

  try {
    const result = await checkAndIncrementFn({ key, limit, windowSec, store });
    return { allowed: result.allowed };
  } catch {
    logRateLimitWarning(requestId, { reason: "store_error" });
    return { allowed: false, unavailable: true };
  }
};

const toJson = (payload: Record<string, unknown>, status: number, requestId: string) =>
  emitEduRouteJsonResponse({
    payload,
    status,
    requestId,
  });

const buildDecorateRateLimitResponse = (requestId: string, unavailable = false) =>
  unavailable
    ? toJson(
        { ok: false, code: "EDU_DECORATE_RATE_LIMIT_UNAVAILABLE", message: "요청을 잠시 처리할 수 없어요." },
        503,
        requestId,
      )
    : toJson({ ok: false, code: "EDU_DECORATE_RATE_LIMITED", message: "요청이 너무 많아요." }, 429, requestId);

// Decorate boundary notes (phase-62):
// 1) This route is the authoritative server-plan orchestration entrypoint.
// 2) Provider path ordering is fixed: backend proxy -> deterministic-safe gate -> direct OpenAI fallback.
// 3) Publish/storage is intentionally out of scope here; it runs in lesson publish routes after
//    the client applies decorate results to workspace files.

// [route-local alias wrapper] decorate route emitter wrapper keeps route-local naming
// while delegating to shared route JSON emitter utility.
export type EduDecorateRouteResponseInput = Pick<EduRouteJsonResponseInput, "payload" | "status" | "requestId">;

const parseDecoratePlanRequest = async (
  request: Request,
  requestId: string,
): Promise<{ ok: true; value: DecorateNormalizedRequest } | { ok: false; response: Response }> => {
  const body = await readEduRouteJsonBody<DecoratePlanRequest>(request);
  if (!body || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return { ok: false, response: toJson({ ok: false, code: "EDU_DECORATE_BAD_REQUEST", message: "prompt가 필요해요." }, 400, requestId) };
  }
  if (typeof body.snapshotVersion !== "string" || body.snapshotVersion.trim().length === 0) {
    return { ok: false, response: toJson({ ok: false, code: "EDU_DECORATE_BAD_REQUEST", message: "snapshotVersion이 필요해요." }, 400, requestId) };
  }

  const prompt = normalizePrompt(body.prompt);
  const snapshotVersion = body.snapshotVersion.trim();
  const slotFingerprint = typeof body.slotFingerprint === "string" ? body.slotFingerprint.trim() : "";
  const slotHintsRaw = isRecord(body.slotHints) ? body.slotHints : null;
  const slotHintsString = safeJsonStringify(slotHintsRaw);

  if (prompt.length < 1 || prompt.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      response: toJson(
        { ok: false, code: "EDU_DECORATE_BAD_REQUEST", message: `prompt 길이는 1~${MAX_PROMPT_LENGTH}자여야 해요.` },
        400,
        requestId,
      ),
    };
  }
  if (snapshotVersion.length > MAX_SNAPSHOT_LENGTH) {
    return { ok: false, response: toJson({ ok: false, code: "EDU_DECORATE_BAD_REQUEST", message: "snapshotVersion 길이가 너무 길어요." }, 400, requestId) };
  }
  if (slotFingerprint.length > MAX_SLOT_FINGERPRINT_LENGTH) {
    return { ok: false, response: toJson({ ok: false, code: "EDU_DECORATE_BAD_REQUEST", message: "slotFingerprint 길이가 너무 길어요." }, 400, requestId) };
  }
  if (slotHintsString.length > MAX_SLOT_HINTS_LENGTH) {
    return { ok: false, response: toJson({ ok: false, code: "EDU_DECORATE_BAD_REQUEST", message: "slotHints가 너무 길어요." }, 400, requestId) };
  }

  const changedNodesCount = Number.isFinite(body.changedNodesCount) ? Math.max(0, Number(body.changedNodesCount)) : 0;

  return {
    ok: true,
    value: {
      prompt,
      snapshotVersion,
      slotFingerprint,
      slotHintsRaw,
      slotHintsString,
      changedNodesCount,
    },
  };
};

const buildDecorateBackendPayload = (normalized: DecorateNormalizedRequest) => ({
  prompt: normalized.prompt,
  snapshotVersion: normalized.snapshotVersion,
  slotFingerprint: normalized.slotFingerprint || null,
  slotHints: normalized.slotHintsRaw,
  changedNodesCount: normalized.changedNodesCount,
});

// [route-local alias wrapper] decorate keeps a route-local emitter name while reusing
// the shared JSON response emitter contract through `toJson` -> `emitEduRouteJsonResponse`.
export const emitEduDecorateRouteJsonResponse = (input: EduDecorateRouteResponseInput) =>
  toJson(input.payload, input.status, input.requestId);

const openAiResponsesJsonSchema = {
  type: "json_schema",
  name: "decorate_plan_v1",
  schema: decoratePlanJsonSchema(),
  strict: true,
} as const;

// [route-local alias wrapper] keep-for-now decorate draft alias for local readability.
type DecorateRouteResponseDraft = EduRouteResponseDraft;

type DecorateBackendServiceStepInput = {
  route: string;
  requestId: string;
  fetchFn: typeof fetch;
  normalizedRequest: DecorateNormalizedRequest;
  cacheEnabled: boolean;
  admin: SupabaseQueryClient | null;
  cacheKey: string;
  userIdForCache: string;
  promptHash: string;
  snapshotVersion: string;
  slotFingerprint: string;
  authScope: "user" | "join";
  shareCodeHash: string | null;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
};

type DecorateOpenAiFailureCacheBaseContext = {
  cacheEnabled: boolean;
  admin: SupabaseQueryClient | null;
  requestId: string;
  cacheKey: string;
  userIdForCache: string;
  promptHash: string;
  snapshotVersion: string;
  slotFingerprint: string;
  authScope: "user" | "join";
  shareCodeHash: string | null;
};

type DecorateOpenAiFailureCacheContext = DecorateOpenAiFailureCacheBaseContext & {
  model: string;
  llmStartedAt: number;
};

type DecorateDirectOpenAiServiceStepInput = {
  route: string;
  requestId: string;
  fetchFn: typeof fetch;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
  apiKey: string;
  model: string;
  prompt: string;
  snapshotVersion: string;
  slotFingerprint: string;
  slotHintsRaw: SlotMapSummary | null;
  changedNodesCount: number;
  cacheContext: DecorateOpenAiFailureCacheBaseContext;
};

type DecorateTopLevelFlowInput = {
  route: string;
  requestId: string;
  fetchFn: typeof fetch;
  normalizedRequest: DecorateNormalizedRequest;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
  apiKey: string;
  model: string;
  cacheEnabled: boolean;
  admin: SupabaseQueryClient | null;
  cacheKey: string;
  userIdForCache: string;
  promptHash: string;
  authScope: "user" | "join";
  shareCodeHash: string | null;
};

type DecorateDirectOpenAiStepBoundaryInput = Pick<
  DecorateTopLevelFlowInput,
  | "route"
  | "requestId"
  | "fetchFn"
  | "openAiEnv"
  | "apiKey"
  | "model"
  | "cacheEnabled"
  | "admin"
  | "cacheKey"
  | "userIdForCache"
  | "promptHash"
  | "authScope"
  | "shareCodeHash"
> & {
  normalizedRequest: DecorateNormalizedRequest;
};

type DecorateExecutionPathDecision =
  | { path: "service"; draft: DecorateRouteResponseDraft }
  | { path: "direct_openai" };

type DecorateDirectOpenAiFailureDraft = {
  diagnostics: DecorateSafeDiagnostics;
  logReason: string;
  cacheReason: string;
  payload: Record<string, unknown>;
  status: number;
};

const runDecorateBackendStep = async (input: {
  route: string;
  requestId: string;
  fetchFn: typeof fetch;
  normalizedRequest: DecorateNormalizedRequest;
}) =>
  postEduAiBackend({
    route: input.route,
    kind: "decorate",
    requestId: input.requestId,
    fetchFn: input.fetchFn,
    payload: buildDecorateBackendPayload(input.normalizedRequest),
  });

const interpretDecorateBackendResult = (backendResult: Awaited<ReturnType<typeof postEduAiBackend>>) => {
  if (!backendResult.ok) {
    return { ok: false } as const;
  }

  const parsed = (backendResult.body ?? null) as { plan?: unknown } | null;
  const validated = validateDecoratePlanV1(parsed?.plan);
  if (!validated.ok) {
    return { ok: false } as const;
  }

  return { ok: true, plan: validated.plan } as const;
};

const shouldUseDecorateDeterministicFallback = () =>
  readOpenAiDirectDisabled() || readStudentAiSafeModeEnabled() || readDecorateDeterministicForced();

const buildDecorateDeterministicFallbackDraft = (diagnostics: DecorateSafeDiagnostics): DecorateRouteResponseDraft => ({
  payload: { ok: true, provider: EDU_PROVIDER_LABEL.deterministicSafe, plan: SAFE_FALLBACK_PLAN, diagnostics },
  status: 200,
});

const buildDecorateBackendProxySuccessDraft = (plan: Record<string, unknown>): DecorateRouteResponseDraft => ({
  payload: { ok: true, provider: EDU_PROVIDER_TARGET.backendProxy, plan },
  status: 200,
});

const buildDecorateDirectOpenAiSuccessDraft = (plan: Record<string, unknown>): DecorateRouteResponseDraft => ({
  payload: { ok: true, provider: EDU_PROVIDER_LABEL.serverLlm, plan },
  status: 200,
});

const buildDecorateDirectOpenAiParseFailureDraft = (input: {
  route: string;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
  upstreamStatus: number;
  providerAttempted: DecorateProviderAttempted;
  upstreamErrorType: "response_parse_error" | "response_missing_output_text" | "provider_invalid_json";
  validationMessage: string;
}): DecorateDirectOpenAiFailureDraft => {
  const diagnostics: DecorateSafeDiagnostics = buildDecorateDiagnostics({
    route: input.route,
    openAiEnv: input.openAiEnv,
    upstreamStatus: input.upstreamStatus,
    upstreamErrorType: input.upstreamErrorType,
    mappedReason: "openai_schema_invalid",
    timeoutHit: false,
    usedGateway: false,
    providerAttempted: input.providerAttempted,
  });

  const reasonByErrorType: Record<typeof input.upstreamErrorType, string> = {
    response_parse_error: "provider_parse_error",
    response_missing_output_text: "provider_schema_missing_text",
    provider_invalid_json: "provider_invalid_json",
  };
  const reason = reasonByErrorType[input.upstreamErrorType];
  return {
    diagnostics,
    logReason: reason,
    cacheReason: reason,
    payload: { ok: false, code: "EDU_DECORATE_PARSE_ERROR", message: input.validationMessage, reason: "openai_schema_invalid", diagnostics },
    status: 502,
  };
};

const buildDecorateDirectOpenAiSchemaFailureDraft = (input: {
  route: string;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
  upstreamStatus: number;
  providerAttempted: DecorateProviderAttempted;
  validationReason: string;
}): DecorateDirectOpenAiFailureDraft => {
  const diagnostics: DecorateSafeDiagnostics = buildDecorateDiagnostics({
    route: input.route,
    openAiEnv: input.openAiEnv,
    upstreamStatus: input.upstreamStatus,
    upstreamErrorType: "provider_schema_invalid",
    mappedReason: "openai_schema_invalid",
    timeoutHit: false,
    usedGateway: false,
    providerAttempted: input.providerAttempted,
  });

  return {
    diagnostics,
    logReason: "provider_schema_invalid",
    cacheReason: "provider_schema_invalid",
    payload: {
      ok: false,
      code: "EDU_DECORATE_SCHEMA_ERROR",
      message: "서버 LLM plan 검증에 실패했어요.",
      reason: "openai_schema_invalid",
      validationReason: input.validationReason,
      diagnostics,
    },
    status: 502,
  };
};

const buildDecorateDirectOpenAiRuntimeFailureDraft = (input: {
  route: string;
  openAiEnv: ReturnType<typeof readOpenAiApiKeyFromEnv>;
  providerAttempted: DecorateProviderAttempted;
  error: unknown;
}): DecorateDirectOpenAiFailureDraft => {
  const classified = classifyProviderError(input.error);
  const diagnostics: DecorateSafeDiagnostics = buildDecorateDiagnostics({
    route: input.route,
    openAiEnv: input.openAiEnv,
    upstreamStatus: null,
    upstreamErrorType: input.error instanceof Error ? input.error.name : "unknown_error",
    mappedReason: classified.mappedReason,
    timeoutHit: classified.timeoutHit,
    usedGateway: false,
    providerAttempted: input.providerAttempted,
  });

  return {
    diagnostics,
    logReason: classified.mappedReason,
    cacheReason: classified.mappedReason,
    payload: {
      ok: false,
      code: classified.code,
      message: classified.mappedReason === "openai_timeout" ? "서버 LLM plan 생성이 시간 초과되었어요." : "서버 LLM plan 생성에 실패했어요.",
      reason: classified.mappedReason,
      diagnostics,
    },
    status: classified.status,
  };
};

const writeDecorateDirectOpenAiFailureCache = async (
  input: DecorateOpenAiFailureCacheContext,
  cacheReason: string,
) => {
  await safeWriteCacheRow(input.cacheEnabled, input.admin, input.requestId, {
    key: input.cacheKey,
    userId: input.userIdForCache,
    expiresAt: new Date(Date.now() + CACHE_NEGATIVE_TTL_MS).toISOString(),
    planJson: { ok: false, reason: cacheReason },
    meta: {
      promptHash: input.promptHash,
      snapshotVersion: input.snapshotVersion,
      slotFingerprint: input.slotFingerprint,
      provider: EDU_PROVIDER_LABEL.openAi,
      model: input.model,
      latencyMs: Math.max(0, Date.now() - input.llmStartedAt),
      authScope: input.authScope,
      shareCodeHash: input.shareCodeHash,
    },
  });
};

const finalizeDecorateDirectOpenAiFailure = async (input: {
  requestId: string;
  cacheContext: DecorateOpenAiFailureCacheBaseContext;
  model: string;
  llmStartedAt: number;
  failureDraft: DecorateDirectOpenAiFailureDraft;
  logMeta?: Record<string, unknown>;
}): Promise<DecorateRouteResponseDraft> => {
  logDecoratePlanServerError(input.failureDraft.logReason, input.requestId, {
    ...input.failureDraft.diagnostics,
    ...(input.logMeta ?? {}),
    authScope: input.cacheContext.authScope,
    shareCodeHash: input.cacheContext.shareCodeHash,
  });
  await writeDecorateDirectOpenAiFailureCache(
    { ...input.cacheContext, model: input.model, llmStartedAt: input.llmStartedAt },
    input.failureDraft.cacheReason,
  );
  return { payload: input.failureDraft.payload, status: input.failureDraft.status };
};

const runDecorateDirectOpenAiStep = async (input: DecorateDirectOpenAiServiceStepInput): Promise<DecorateRouteResponseDraft> => {
  const controller = new AbortController();
  const llmStartedAt = Date.now();
  const timeout = setTimeout(() => controller.abort("timeout"), PLAN_TIMEOUT_MS);

  try {
    console.info("decorate_openai_attempt_started", {
      requestId: input.requestId,
      model: input.model,
      authScope: input.cacheContext.authScope,
      openAiEnvSource: input.openAiEnv.envSource,
      openAiEnvKey: input.openAiEnv.envKey,
    });
    const { headers: authHeaders, context } = buildOpenAiAuthHeaders(input.apiKey, { "Content-Type": "application/json" });
    const response = await input.fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: authHeaders,
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: [
                  "You are decorate-plan generator.",
                  "Return ONLY DecoratePlan DSL v1 JSON object.",
                  "Never output HTML, CSS, JS, markdown, or explanation.",
                  "DecoratePlan DSL v1만 반환.",
                  "외부 URL 금지.",
                  "script / on* handler / javascript: 금지.",
                  "target은 slot 기반 우선(가능하면 selector 쓰지 말 것).",
                  "Use provided slot hints and slot fingerprint to target valid slots.",
                ].join("\n"),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    prompt: input.prompt,
                    snapshotVersion: input.snapshotVersion,
                    slotFingerprint: input.slotFingerprint || null,
                    slotHints: input.slotHintsRaw,
                    changedNodesCount: input.changedNodesCount,
                  },
                  null,
                  2,
                ),
              },
            ],
          },
        ],
        temperature: 0,
        max_output_tokens: 450,
        text: {
          format: openAiResponsesJsonSchema,
        },
      }),
    });

    const upstreamHeaders = getOpenAiResponseHeaderDiagnostics(response);
    console.info("decorate_openai_attempt_finished", {
      requestId: input.requestId,
      status: response.status,
      latencyMs: Math.max(0, Date.now() - llmStartedAt),
      openAiEnvSource: input.openAiEnv.envSource,
      openAiEnvKey: input.openAiEnv.envKey,
      ...upstreamHeaders,
      openAiProjectConfigured: Boolean(context.projectId),
      openAiOrganizationConfigured: Boolean(context.organizationId),
    });

    if (!response.ok) {
      const classified = classifyOpenAiStatus(response.status);
      let upstreamErrorType: string | null = null;
      const upstreamErrorText = await response.text().catch(() => "");
      if (upstreamErrorText) {
        try {
          const parsedError = JSON.parse(upstreamErrorText) as { error?: { type?: unknown } };
          upstreamErrorType = typeof parsedError.error?.type === "string" ? parsedError.error.type : null;
        } catch {
          upstreamErrorType = null;
        }
      }
      const diagnostics: DecorateSafeDiagnostics = buildDecorateDiagnostics({
        route: input.route,
        openAiEnv: input.openAiEnv,
        upstreamStatus: response.status,
        upstreamErrorType,
        mappedReason: classified.reason,
        timeoutHit: false,
        usedGateway: false,
        providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
        reasonDetail: `upstream_status_${response.status}`,
        ...upstreamHeaders,
      });
      logDecoratePlanServerError(classified.reason, input.requestId, {
        ...diagnostics,
        authScope: input.cacheContext.authScope,
        shareCodeHash: input.cacheContext.shareCodeHash,
      });
      await safeWriteCacheRow(input.cacheContext.cacheEnabled, input.cacheContext.admin, input.requestId, {
        key: input.cacheContext.cacheKey,
        userId: input.cacheContext.userIdForCache,
        expiresAt: new Date(Date.now() + CACHE_NEGATIVE_TTL_MS).toISOString(),
        planJson: { ok: false, reason: classified.reason },
        meta: {
          promptHash: input.cacheContext.promptHash,
          snapshotVersion: input.cacheContext.snapshotVersion,
          slotFingerprint: input.cacheContext.slotFingerprint,
          provider: EDU_PROVIDER_LABEL.openAi,
          model: input.model,
          status: response.status,
          upstreamErrorType,
          latencyMs: Math.max(0, Date.now() - llmStartedAt),
          authScope: input.cacheContext.authScope,
          shareCodeHash: input.cacheContext.shareCodeHash,
        },
      });
      return {
        payload: {
          ok: false,
          code: classified.code,
          message: "서버 LLM 호출에 실패했어요.",
          reason: classified.reason,
          upstreamStatus: response.status,
          diagnostics,
        },
        status: classified.responseStatus,
      };
    }

    const data = (await response.json().catch(() => null)) as
      | { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
      | null;

    if (!data) {
      const failureDraft = buildDecorateDirectOpenAiParseFailureDraft({
        route: input.route,
        openAiEnv: input.openAiEnv,
        upstreamStatus: response.status,
        providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
        upstreamErrorType: "response_parse_error",
        validationMessage: "서버 LLM 응답을 읽지 못했어요.",
      });
      return finalizeDecorateDirectOpenAiFailure({
        requestId: input.requestId,
        cacheContext: input.cacheContext,
        model: input.model,
        llmStartedAt,
        failureDraft,
      });
    }

    const candidateText =
      (typeof data.output_text === "string" && data.output_text) ||
      data.output?.flatMap((item) => item.content ?? []).find((content) => content?.type === "output_text")?.text;

    if (typeof candidateText !== "string") {
      const failureDraft = buildDecorateDirectOpenAiParseFailureDraft({
        route: input.route,
        openAiEnv: input.openAiEnv,
        upstreamStatus: response.status,
        providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
        upstreamErrorType: "response_missing_output_text",
        validationMessage: "서버 LLM 응답을 읽지 못했어요.",
      });
      return finalizeDecorateDirectOpenAiFailure({
        requestId: input.requestId,
        cacheContext: input.cacheContext,
        model: input.model,
        llmStartedAt,
        failureDraft,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(candidateText) as unknown;
    } catch {
      const failureDraft = buildDecorateDirectOpenAiParseFailureDraft({
        route: input.route,
        openAiEnv: input.openAiEnv,
        upstreamStatus: response.status,
        providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
        upstreamErrorType: "provider_invalid_json",
        validationMessage: "서버 LLM 응답 JSON 파싱에 실패했어요.",
      });
      return finalizeDecorateDirectOpenAiFailure({
        requestId: input.requestId,
        cacheContext: input.cacheContext,
        model: input.model,
        llmStartedAt,
        failureDraft,
      });
    }

    const validated = validateDecoratePlanV1(parsed);
    if (!validated.ok) {
      const failureDraft = buildDecorateDirectOpenAiSchemaFailureDraft({
        route: input.route,
        openAiEnv: input.openAiEnv,
        upstreamStatus: response.status,
        providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
        validationReason: validated.reason,
      });
      return finalizeDecorateDirectOpenAiFailure({
        requestId: input.requestId,
        cacheContext: input.cacheContext,
        model: input.model,
        llmStartedAt,
        failureDraft,
        logMeta: { validationReason: validated.reason },
      });
    }

    await safeWriteCacheRow(input.cacheContext.cacheEnabled, input.cacheContext.admin, input.requestId, {
      key: input.cacheContext.cacheKey,
      userId: input.cacheContext.userIdForCache,
      expiresAt: new Date(Date.now() + CACHE_SUCCESS_TTL_MS).toISOString(),
      planJson: { ok: true, plan: validated.plan },
      meta: {
        promptHash: input.cacheContext.promptHash,
        snapshotVersion: input.cacheContext.snapshotVersion,
        slotFingerprint: input.cacheContext.slotFingerprint,
        provider: EDU_PROVIDER_LABEL.openAi,
        model: input.model,
        latencyMs: Math.max(0, Date.now() - llmStartedAt),
        authScope: input.cacheContext.authScope,
        shareCodeHash: input.cacheContext.shareCodeHash,
      },
    });

    return buildDecorateDirectOpenAiSuccessDraft(validated.plan);
  } catch (error) {
    const failureDraft = buildDecorateDirectOpenAiRuntimeFailureDraft({
      route: input.route,
      openAiEnv: input.openAiEnv,
      providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
      error,
    });
    return finalizeDecorateDirectOpenAiFailure({
      requestId: input.requestId,
      cacheContext: input.cacheContext,
      model: input.model,
      llmStartedAt,
      failureDraft,
      logMeta: { errorType: "provider_runtime" },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const runDecoratePlanServiceStep = async (input: DecorateBackendServiceStepInput): Promise<DecorateRouteResponseDraft | null> => {
  // Service step owns backend-proxy attempt and deterministic-safe short-circuit policy.
  // Direct OpenAI fallback is intentionally deferred to `runDecorateDirectOpenAiStep` only.
  const backendResult = await runDecorateBackendStep({
    route: input.route,
    requestId: input.requestId,
    fetchFn: input.fetchFn,
    normalizedRequest: input.normalizedRequest,
  });

  const backendInterpretation = interpretDecorateBackendResult(backendResult);
  if (backendInterpretation.ok) {
    await safeWriteCacheRow(input.cacheEnabled, input.admin, input.requestId, {
      key: input.cacheKey,
      userId: input.userIdForCache,
      expiresAt: new Date(Date.now() + CACHE_SUCCESS_TTL_MS).toISOString(),
      planJson: { ok: true, plan: backendInterpretation.plan },
      meta: {
        promptHash: input.promptHash,
        snapshotVersion: input.snapshotVersion,
        slotFingerprint: input.slotFingerprint,
        provider: EDU_PROVIDER_TARGET.backendProxy,
        authScope: input.authScope,
        shareCodeHash: input.shareCodeHash,
      },
    });
    return buildDecorateBackendProxySuccessDraft(backendInterpretation.plan);
  }

  if (shouldUseDecorateDeterministicFallback()) {
    const diagnostics: DecorateSafeDiagnostics = buildDecorateBackendFallbackDiagnostics({
      route: input.route,
      openAiEnv: input.openAiEnv,
      backendDiagnostics: backendResult.diagnostics,
    }) as DecorateSafeDiagnostics;
    logDecoratePlanServerError("backend_proxy_failed", input.requestId, diagnostics);
    return buildDecorateDeterministicFallbackDraft(diagnostics);
  }

  return null;
};

const decideDecorateExecutionPath = (serviceDraft: DecorateRouteResponseDraft | null): DecorateExecutionPathDecision => {
  if (serviceDraft) {
    return { path: "service", draft: serviceDraft };
  }
  return { path: "direct_openai" };
};

const buildDecorateDirectOpenAiStepInput = (
  input: DecorateDirectOpenAiStepBoundaryInput,
): DecorateDirectOpenAiServiceStepInput => ({
  route: input.route,
  requestId: input.requestId,
  fetchFn: input.fetchFn,
  openAiEnv: input.openAiEnv,
  apiKey: input.apiKey,
  model: input.model,
  prompt: input.normalizedRequest.prompt,
  snapshotVersion: input.normalizedRequest.snapshotVersion,
  slotFingerprint: input.normalizedRequest.slotFingerprint,
  slotHintsRaw: input.normalizedRequest.slotHintsRaw,
  changedNodesCount: input.normalizedRequest.changedNodesCount,
  cacheContext: {
    cacheEnabled: input.cacheEnabled,
    admin: input.admin,
    requestId: input.requestId,
    cacheKey: input.cacheKey,
    userIdForCache: input.userIdForCache,
    promptHash: input.promptHash,
    snapshotVersion: input.normalizedRequest.snapshotVersion,
    slotFingerprint: input.normalizedRequest.slotFingerprint,
    authScope: input.authScope,
    shareCodeHash: input.shareCodeHash,
  },
});

const executeDecoratePlanFlow = async (input: DecorateTopLevelFlowInput): Promise<DecorateRouteResponseDraft> => {
  const serviceDraft = await runDecoratePlanServiceStep({
    route: input.route,
    requestId: input.requestId,
    fetchFn: input.fetchFn,
    normalizedRequest: input.normalizedRequest,
    cacheEnabled: input.cacheEnabled,
    admin: input.admin,
    cacheKey: input.cacheKey,
    userIdForCache: input.userIdForCache,
    promptHash: input.promptHash,
    snapshotVersion: input.normalizedRequest.snapshotVersion,
    slotFingerprint: input.normalizedRequest.slotFingerprint,
    authScope: input.authScope,
    shareCodeHash: input.shareCodeHash,
    openAiEnv: input.openAiEnv,
  });

  const executionDecision = decideDecorateExecutionPath(serviceDraft);
  if (executionDecision.path === "service") {
    return executionDecision.draft;
  }

  return runDecorateDirectOpenAiStep(buildDecorateDirectOpenAiStepInput(input));
};

export async function postDecoratePlanWithDeps(
  request: Request,
  deps: DecoratePlanRouteDeps = {},
  adapterContext?: { requestId: string; route: string },
) {
  // Top-level route flow intentionally keeps order stable for rollback safety:
  // request normalization -> auth/join/rate-limit/cache -> provider execution.
  const requestId = adapterContext?.requestId ?? getOrCreateRequestId(request);
  const route = adapterContext?.route ?? new URL(request.url).pathname;
  try {
    const normalizedRequest = await parseDecoratePlanRequest(request, requestId);
    if (!normalizedRequest.ok) {
      return normalizedRequest.response;
    }
    const { prompt, snapshotVersion, slotFingerprint } = normalizedRequest.value;

    const createSupabaseServerClientFn = deps.createSupabaseServerClientFn ?? createSupabaseServerClient;
    const createSupabaseAdminClientFn = deps.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const resolveJoinTokenFromRequestFn = deps.resolveJoinTokenFromRequestFn ?? resolveJoinTokenFromRequest;
    const getEduJoinSessionFn = deps.getEduJoinSessionFn ?? getEduJoinSession;
    const checkAndIncrementFn = deps.checkAndIncrementFn ?? checkAndIncrement;
    const fetchFn = deps.fetchFn ?? fetch;

    if (PROMPT_BANNED_TOKEN_REGEX.test(prompt)) {
      return toJson({ ok: true, provider: EDU_PROVIDER_LABEL.deterministicSafe, plan: SAFE_FALLBACK_PLAN }, 200, requestId);
    }

    const supabase = createSupabaseServerClientFn();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const joinToken = resolveJoinTokenFromRequestFn(request);
    const joinTokenHash = joinToken ? await digestHex("SHA-256", joinToken) : null;
    const joinResolution = joinToken
      ? await safeResolveJoinSession(joinToken, getEduJoinSessionFn)
      : { session: null, state: "invalid" as const };
    const hasUserSession = Boolean(user?.id);
    const hasJoinSession = Boolean(joinResolution.session?.shareCode);

    if (!hasUserSession && !hasJoinSession) {
      if (joinToken) {
        logJoinSessionWarning(requestId, {
          state: joinResolution.state,
          joinTokenHash,
        });
      }
      return toJson({ ok: false, code: "EDU_DECORATE_UNAUTHORIZED", message: "로그인이 필요해요." }, 401, requestId);
    }

    const openAiEnv = readOpenAiApiKeyFromEnv();
    const apiKey = openAiEnv.apiKey;
    const model = readOpenAiModel();
    if (!apiKey) {
      const diagnostics: DecorateSafeDiagnostics = buildDecorateDiagnostics({
        route,
        openAiEnv,
        upstreamStatus: null,
        upstreamErrorType: "api_key_missing",
        mappedReason: "openai_auth",
        timeoutHit: false,
        usedGateway: false,
        providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
        reasonDetail: "api_key_missing",
        openaiRequestId: null,
        openaiOrganization: null,
        openaiVersion: null,
      });
      logDecoratePlanServerError("openai_auth", requestId, diagnostics);
      return toJson(
        { ok: false, code: "EDU_DECORATE_PROVIDER_MISSING", message: "서버 LLM 설정이 없어요.", reason: "openai_auth", diagnostics },
        503,
        requestId,
      );
    }
    if (model !== DEFAULT_MODEL && !/^gpt-/i.test(model)) {
      logDecoratePlanServerError("openai_model_suspect", requestId, { model });
    }

    console.info("decorate_provider_availability_checked", {
      requestId,
      hasOpenAiKey: true,
      hasSupabaseServiceRoleKey: Boolean(readEnvString("SUPABASE_SERVICE_ROLE_KEY")),
      openAiEnvSource: openAiEnv.envSource,
      openAiEnvKey: openAiEnv.envKey,
      openAiKeyFormat: openAiEnv.keyFormat,
        openAiKeyVariant: openAiEnv.keyVariant,
    });

    const requesterKey = hasUserSession ? `user:${user!.id}` : `join:${joinResolution.session!.shareCode}`;
    const authScope = hasUserSession ? "user" : "join";
    const shareCodeHash = hasJoinSession ? await digestHex("SHA-256", joinResolution.session!.shareCode) : null;
    const cacheEnabled = hasUserSession;
    const userIdForCache = user?.id ?? "join_cache_skip";

    const admin = safeCreateAdminClient(() => createSupabaseAdminClientFn(), requestId);
    const limiter = admin ? new SupabaseRateLimitStore(admin as never) : null;

    const clientIp = getClientIp(request);
    const minuteUser = await safeRateLimitCheck({
      checkAndIncrementFn,
      store: limiter,
      key: `edu:decorate:plan:${requesterKey}:m1`,
      limit: RATE_LIMIT_USER_MINUTE,
      windowSec: 60,
      requestId,
    });
    if (!minuteUser.allowed) {
      return buildDecorateRateLimitResponse(requestId, minuteUser.unavailable);
    }
    const hourUser = await safeRateLimitCheck({
      checkAndIncrementFn,
      store: limiter,
      key: `edu:decorate:plan:${requesterKey}:h1`,
      limit: RATE_LIMIT_USER_HOUR,
      windowSec: 3600,
      requestId,
    });
    if (!hourUser.allowed) {
      return buildDecorateRateLimitResponse(requestId, hourUser.unavailable);
    }
    if (clientIp && clientIp !== "unknown") {
      const minuteIp = await safeRateLimitCheck({
        checkAndIncrementFn,
        store: limiter,
        key: `edu:decorate:plan:ip:${clientIp}:m1`,
        limit: RATE_LIMIT_IP_MINUTE,
        windowSec: 60,
        requestId,
      });
      if (!minuteIp.allowed) {
        return buildDecorateRateLimitResponse(requestId, minuteIp.unavailable);
      }
    }

    const promptHash = await digestHex("SHA-256", prompt);
    const cacheKey = await digestHex("SHA-256", `${requesterKey}|${snapshotVersion}|${prompt}|${slotFingerprint || "none"}`);

    const cacheRow = cacheEnabled ? await safeReadCacheRow(admin, cacheKey, requestId) : null;
    if (cacheRow) {
      const expiresAt = Date.parse(cacheRow.expires_at as string);
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        const cachedPlan = (cacheRow.plan_json ?? null) as { ok?: boolean; reason?: string; plan?: unknown } | null;
        if (cachedPlan?.ok === false) {
          const reason = typeof cachedPlan.reason === "string" ? cachedPlan.reason : "provider_status";
          logDecoratePlanServerError(reason, requestId, { provider: EDU_PROVIDER_LABEL.cache, cacheHit: true, authScope, shareCodeHash });
          return toJson(
            {
              ok: false,
              code: reason === "timeout" ? "EDU_DECORATE_TIMEOUT" : "EDU_DECORATE_PROVIDER_ERROR",
              message: reason === "timeout" ? "서버 LLM plan 생성이 시간 초과되었어요." : "서버 LLM plan 생성에 실패했어요.",
            },
            reason === "timeout" ? 504 : 502,
            requestId,
          );
        }

        const validated = validateDecoratePlanV1(cachedPlan?.plan);
        if (validated.ok) {
          return toJson({ ok: true, provider: EDU_PROVIDER_LABEL.cache, plan: validated.plan }, 200, requestId);
        }
      }
    }

    const decorateRouteDraft = await executeDecoratePlanFlow({
      route,
      requestId,
      fetchFn,
      normalizedRequest: normalizedRequest.value,
      openAiEnv,
      apiKey,
      model,
      cacheEnabled,
      admin,
      cacheKey,
      userIdForCache,
      promptHash,
      authScope,
      shareCodeHash,
    });

    return toJson(decorateRouteDraft.payload, decorateRouteDraft.status, requestId);
  } catch (error) {
    const openAiEnv = readOpenAiApiKeyFromEnv();
    const diagnostics: DecorateSafeDiagnostics = buildDecorateDiagnostics({
      route,
      openAiEnv,
      upstreamStatus: null,
      upstreamErrorType: error instanceof Error ? error.name : "unknown_error",
      mappedReason: "route_unknown",
      timeoutHit: false,
      usedGateway: false,
      providerAttempted: EDU_PROVIDER_TARGET.openAiDirectLegacy,
    });
    console.error("decorate_plan_route_unhandled", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
      ...diagnostics,
    });
    return toJson({ ok: false, code: "EDU_DECORATE_INTERNAL_ERROR", message: "요청 처리 중 오류가 발생했어요.", reason: "route_unknown", diagnostics }, 500, requestId);
  }
}

// [route-local alias wrapper] decorate keeps a local adapter-context name while
// reusing the shared student route adapter context contract.
export type DecorateRouteAdapterContext = EduRouteAdapterContext;

export async function runEduDecoratePlanRouteService(
  request: Request,
  deps: DecoratePlanRouteDeps = {},
  adapterContext?: DecorateRouteAdapterContext,
) {
  return postDecoratePlanWithDeps(request, deps, adapterContext);
}
