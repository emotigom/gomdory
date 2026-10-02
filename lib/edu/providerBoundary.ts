// phase-21 structural-refactor pivot:
// Keep provider selection behavior unchanged while centralizing provider boundary labels/types
// so future extraction can split mainline/provider/debug layers with smaller diffs.

export const EDU_PROVIDER_TARGET = {
  backendProxy: "backend_proxy",
  openAiDirectLegacy: "openai_direct_legacy",
  deterministicFallback: "deterministic_fallback",
  planCSafeMode: "plan_c_safe_mode",
  planCTemplate: "plan_c_template",
} as const;

export type EduProviderTarget = (typeof EDU_PROVIDER_TARGET)[keyof typeof EDU_PROVIDER_TARGET];

export const EDU_AI_PROVIDER_BOUNDARY = {
  studentMainline: EDU_PROVIDER_TARGET.backendProxy,
  directOpenAiLegacyFallback: EDU_PROVIDER_TARGET.openAiDirectLegacy,
  deterministicFallback: EDU_PROVIDER_TARGET.deterministicFallback,
} as const;

export type EduAiProviderAttempted =
  | typeof EDU_PROVIDER_TARGET.backendProxy
  | typeof EDU_PROVIDER_TARGET.openAiDirectLegacy
  | typeof EDU_PROVIDER_TARGET.deterministicFallback;

export const EDU_PROVIDER_LABEL = {
  cache: "cache",
  openAi: "openai",
  serverLlm: "server_llm",
  deterministicSafe: "deterministic_safe",
  webllm: "webllm",
} as const;

export type EduProviderLabel = (typeof EDU_PROVIDER_LABEL)[keyof typeof EDU_PROVIDER_LABEL];

export type EduProviderBoundaryCategory =
  | "canonical_mainline"
  | "legacy_but_still_used"
  | "conditional_local"
  | "deterministic_fallback";

export const EDU_PROVIDER_RESULT = {
  ok: "ok",
  failed: "failed",
} as const;

export type EduProviderResult = (typeof EDU_PROVIDER_RESULT)[keyof typeof EDU_PROVIDER_RESULT];

export type EduProviderStatusCategory =
  | "provider_ok"
  | "provider_timeout"
  | "provider_upstream_error"
  | "provider_network_error"
  | "provider_unknown";

const EDU_AI_PROVIDER_ATTEMPTED_SET = new Set<EduAiProviderAttempted>([
  EDU_PROVIDER_TARGET.backendProxy,
  EDU_PROVIDER_TARGET.openAiDirectLegacy,
  EDU_PROVIDER_TARGET.deterministicFallback,
]);

export function normalizeEduAiProviderAttempt(
  value: unknown,
  fallback: EduAiProviderAttempted = EDU_PROVIDER_TARGET.backendProxy,
): EduAiProviderAttempted {
  if (typeof value === "string" && EDU_AI_PROVIDER_ATTEMPTED_SET.has(value as EduAiProviderAttempted)) {
    return value as EduAiProviderAttempted;
  }
  return fallback;
}

export function normalizeProviderAttemptedValue(
  value: unknown,
  fallback: EduAiProviderAttempted = EDU_PROVIDER_TARGET.backendProxy,
): EduAiProviderAttempted {
  return normalizeEduAiProviderAttempt(value, fallback);
}

export function normalizeProviderResult(value: unknown, fallback: EduProviderResult = EDU_PROVIDER_RESULT.failed): EduProviderResult {
  if (value === EDU_PROVIDER_RESULT.ok || value === EDU_PROVIDER_RESULT.failed) return value;
  return fallback;
}

export function isCanonicalMainlineProvider(value: unknown): value is typeof EDU_PROVIDER_TARGET.backendProxy {
  return value === EDU_PROVIDER_TARGET.backendProxy;
}

export function isLegacyProvider(value: unknown): value is typeof EDU_PROVIDER_TARGET.openAiDirectLegacy {
  return value === EDU_PROVIDER_TARGET.openAiDirectLegacy;
}

export function isConditionalLocalProvider(value: unknown): boolean {
  return value === EDU_PROVIDER_TARGET.planCSafeMode || value === EDU_PROVIDER_TARGET.planCTemplate || value === EDU_PROVIDER_LABEL.webllm;
}

export function getProviderBoundaryCategory(value: unknown): EduProviderBoundaryCategory {
  if (isCanonicalMainlineProvider(value)) return "canonical_mainline";
  if (isLegacyProvider(value)) return "legacy_but_still_used";
  if (value === EDU_PROVIDER_TARGET.deterministicFallback || value === EDU_PROVIDER_LABEL.deterministicSafe) return "deterministic_fallback";
  return "conditional_local";
}

export function getProviderDebugLabel(value: unknown): string {
  const category = getProviderBoundaryCategory(value);
  if (category === "canonical_mainline") return "student_mainline_backend_proxy";
  if (category === "legacy_but_still_used") return "legacy_direct_openai";
  if (category === "deterministic_fallback") return "deterministic_fallback";
  return "conditional_local_provider";
}

export function getProviderSourceLabel(value: unknown): EduProviderLabel {
  if (isCanonicalMainlineProvider(value)) return EDU_PROVIDER_LABEL.serverLlm;
  if (isLegacyProvider(value)) return EDU_PROVIDER_LABEL.openAi;
  if (value === EDU_PROVIDER_TARGET.deterministicFallback || value === EDU_PROVIDER_LABEL.deterministicSafe) return EDU_PROVIDER_LABEL.deterministicSafe;
  if (value === EDU_PROVIDER_LABEL.cache) return EDU_PROVIDER_LABEL.cache;
  return EDU_PROVIDER_LABEL.webllm;
}

export function getProviderStatusCategory(status: number | null, timeoutHit: boolean): EduProviderStatusCategory {
  if (timeoutHit) return "provider_timeout";
  if (typeof status === "number" && status >= 200 && status < 300) return "provider_ok";
  if (typeof status === "number" && status >= 500) return "provider_upstream_error";
  if (status === null) return "provider_network_error";
  return "provider_unknown";
}

export function buildProviderDebugPayload(input: {
  providerAttempted: unknown;
  status: number | null;
  timeoutHit: boolean;
  result?: unknown;
}) {
  const providerAttempted = normalizeProviderAttemptedValue(input.providerAttempted);
  return {
    providerAttempted,
    providerBoundaryCategory: getProviderBoundaryCategory(providerAttempted),
    providerDebugLabel: getProviderDebugLabel(providerAttempted),
    providerSourceLabel: getProviderSourceLabel(providerAttempted),
    providerStatusCategory: getProviderStatusCategory(input.status, input.timeoutHit),
    providerResult: normalizeProviderResult(input.result, input.status !== null && input.status >= 200 && input.status < 300 ? EDU_PROVIDER_RESULT.ok : EDU_PROVIDER_RESULT.failed),
  };
}

export function buildProviderResultStatus(input: { status: number | null; timeoutHit: boolean; result?: unknown }) {
  return {
    providerStatusCategory: getProviderStatusCategory(input.status, input.timeoutHit),
    providerResult: normalizeProviderResult(input.result, input.status !== null && input.status >= 200 && input.status < 300 ? EDU_PROVIDER_RESULT.ok : EDU_PROVIDER_RESULT.failed),
  };
}

export function getProviderAttemptDescriptor(input: { providerAttempted: unknown }) {
  const providerAttempted = normalizeProviderAttemptedValue(input.providerAttempted);
  return {
    providerAttempted,
    providerBoundaryCategory: getProviderBoundaryCategory(providerAttempted),
    providerDebugLabel: getProviderDebugLabel(providerAttempted),
    providerSourceLabel: getProviderSourceLabel(providerAttempted),
  };
}

export function buildProviderDiagnosticSummary(input: {
  providerAttempted: unknown;
  backendConfigured: boolean;
  backendStatus: number | null;
  backendRequestId: string | null;
  timeoutHit: boolean;
  mappedReason: string;
  result?: unknown;
}) {
  const providerAttempted = normalizeProviderAttemptedValue(input.providerAttempted);
  return {
    reason: input.mappedReason,
    providerAttempted,
    backendConfigured: input.backendConfigured,
    backendStatus: input.backendStatus,
    backendRequestId: input.backendRequestId,
    timeoutHit: input.timeoutHit,
    providerDebug: buildProviderDebugPayload({
      providerAttempted,
      status: input.backendStatus,
      timeoutHit: input.timeoutHit,
      result: input.result,
    }),
  };
}

type ProviderBackendDiagnosticsInput = {
  providerAttempted: unknown;
  backendConfigured: boolean;
  backendStatus: number | null;
  backendRequestId: string | null;
  timeoutHit: boolean;
  mappedReason: string;
};

export function buildProviderDiagnosticSummaryFromBackendDiagnostics(input: {
  diagnostics: ProviderBackendDiagnosticsInput;
  result?: unknown;
}) {
  return buildProviderDiagnosticSummary({
    providerAttempted: input.diagnostics.providerAttempted,
    backendConfigured: input.diagnostics.backendConfigured,
    backendStatus: input.diagnostics.backendStatus,
    backendRequestId: input.diagnostics.backendRequestId,
    timeoutHit: input.diagnostics.timeoutHit,
    mappedReason: input.diagnostics.mappedReason,
    result: input.result,
  });
}

export function buildProviderFailureResponseFragment(input: {
  diagnostics: ProviderBackendDiagnosticsInput;
  result?: unknown;
}) {
  const summary = buildProviderDiagnosticSummaryFromBackendDiagnostics(input);
  return {
    reason: summary.reason,
    providerAttempted: summary.providerAttempted,
    backendConfigured: summary.backendConfigured,
    backendStatus: summary.backendStatus,
    backendRequestId: summary.backendRequestId,
    timeoutHit: summary.timeoutHit,
  };
}

export function buildProviderFailureEnvelope<TBase extends Record<string, unknown>>(input: {
  base: TBase;
  diagnostics: ProviderBackendDiagnosticsInput;
  result?: unknown;
}) {
  return mergeProviderResponseEnvelope(
    input.base,
    buildProviderFailureResponseFragment({
      diagnostics: input.diagnostics,
      result: input.result,
    }),
  );
}

export function buildProviderBackendFailureEnvelope<TBase extends Record<string, unknown>>(input: {
  base: TBase;
  diagnostics: ProviderBackendDiagnosticsInput;
  result?: unknown;
}) {
  const summary = buildProviderDiagnosticSummaryFromBackendDiagnostics({
    diagnostics: input.diagnostics,
    result: input.result,
  });
  return mergeProviderResponseEnvelope(
    mergeProviderResponseEnvelope(input.base, summary),
    buildProviderFailureResponseFragment({
      diagnostics: input.diagnostics,
      result: input.result,
    }),
  );
}

export function buildProviderDebugSuccessEnvelope<TBase extends Record<string, unknown>>(input: {
  base: TBase;
  providerAttempted: unknown;
  status: number | null;
  timeoutHit: boolean;
  result?: unknown;
}) {
  return mergeProviderDebugPayload(
    input.base,
    buildProviderDebugPayload({
      providerAttempted: input.providerAttempted,
      status: input.status,
      timeoutHit: input.timeoutHit,
      result: input.result,
    }),
  );
}

export function mergeProviderResponseEnvelope<T extends Record<string, unknown>, U extends Record<string, unknown>>(base: T, fragment: U) {
  return { ...base, ...fragment };
}

export function mergeProviderDebugPayload<T extends Record<string, unknown>>(payload: T, providerDebug: Record<string, unknown>) {
  return { ...payload, providerDebug };
}

type DecorateOpenAiEnvDiagnosticsInput = {
  envSource: "cloudflare" | "process" | "missing";
  envKey: "OPENAI_API_KEY" | "OPENAI_KEY" | null;
  keyFormat: "sk" | "non_sk" | "missing";
  keyVariant: "sk_proj" | "sk_legacy" | "non_sk" | "missing";
};

type DecorateDiagnosticsInput = {
  route: string;
  openAiEnv: DecorateOpenAiEnvDiagnosticsInput;
  upstreamStatus: number | null;
  upstreamErrorType: string | null;
  mappedReason: string;
  timeoutHit: boolean;
  usedGateway: boolean;
  providerAttempted: unknown;
  reasonDetail?: string | null;
  openaiRequestId?: string | null;
  openaiOrganization?: string | null;
  openaiVersion?: string | null;
};

export function buildDecorateProviderDiagnostics(input: DecorateDiagnosticsInput) {
  return {
    route: input.route,
    openAiEnvSource: input.openAiEnv.envSource,
    openAiEnvKey: input.openAiEnv.envKey,
    openAiKeyFormat: input.openAiEnv.keyFormat,
    openAiKeyVariant: input.openAiEnv.keyVariant,
    upstreamStatus: input.upstreamStatus,
    upstreamErrorType: input.upstreamErrorType,
    mappedReason: input.mappedReason,
    timeoutHit: input.timeoutHit,
    usedGateway: input.usedGateway,
    providerAttempted: normalizeProviderAttemptedValue(input.providerAttempted),
    reasonDetail: input.reasonDetail,
    openaiRequestId: input.openaiRequestId,
    openaiOrganization: input.openaiOrganization,
    openaiVersion: input.openaiVersion,
  };
}

export function buildDecorateBackendFallbackDiagnostics(input: {
  route: string;
  openAiEnv: DecorateOpenAiEnvDiagnosticsInput;
  backendDiagnostics: ProviderBackendDiagnosticsInput;
}) {
  const mappedReason = input.backendDiagnostics.mappedReason === "backend_timeout" ? "openai_timeout" : "openai_status_unknown";
  return buildDecorateProviderDiagnostics({
    route: input.route,
    openAiEnv: input.openAiEnv,
    upstreamStatus: input.backendDiagnostics.backendStatus,
    upstreamErrorType: input.backendDiagnostics.mappedReason,
    mappedReason,
    timeoutHit: input.backendDiagnostics.timeoutHit,
    usedGateway: true,
    providerAttempted: input.backendDiagnostics.providerAttempted,
  });
}
