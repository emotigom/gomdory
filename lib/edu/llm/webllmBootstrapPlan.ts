import type { EduFeatureFlags } from "@/lib/edu/featureFlags";
import { evaluateWebLLMEnablement, type WebLLMEnableDecision } from "@/lib/edu/llm/webllmFeatureFlags";
import type { WebLLMStatus } from "@/lib/edu/llm/webllmStatus";
import { readWebllmEnvValueWithSource } from "@/lib/edu/llm/webllmConfig";

export type WebllmBootstrapReasonCategory =
  | "ready"
  | "hard_disabled"
  | "entry_blocked"
  | "download_blocked"
  | "feature_flag_disabled"
  | "user_disabled"
  | "auth_required"
  | "env_missing"
  | "degraded"
  | "health_not_ok"
  | "blocked";

export type WebllmBootstrapPlan = {
  baseEnabled: boolean;
  effectiveEnabled: boolean;
  hardDisabled: boolean;
  downloadAllowed: boolean;
  entryBlocked: boolean;
  hasRequiredEnv: boolean;
  envSource: "runtime" | "build" | "unset";
  healthOk: boolean | null;
  healthHardDisabled: boolean | null;
  degradedBlocked: boolean;
  status: WebLLMStatus;
  statusCode: string;
  reasonCategory: WebllmBootstrapReasonCategory;
  authRequired: boolean;
  joinTokenSessionAllowed: boolean;
  shouldAttemptLocalInit: boolean;
  shouldUseServerFallback: boolean;
  webllmEnableDecision: WebLLMEnableDecision;
  debugSnapshot: {
    baseEnabled: boolean;
    effectiveEnabled: boolean;
    hardDisabled: boolean;
    downloadAllowed: boolean;
    entryBlocked: boolean;
    hasRequiredEnv: boolean;
    envSource: "runtime" | "build" | "unset";
    healthOk: boolean | null;
    healthHardDisabled: boolean | null;
    degradedBlocked: boolean;
    authRequired: boolean;
    joinTokenSessionAllowed: boolean;
    reasonCategory: WebllmBootstrapReasonCategory;
    statusCode: string;
  };
};

export type WebllmBootstrapHealthGate = {
  ok: boolean;
  hardDisabled: boolean;
};

export type ResolveWebllmBootstrapPlanInput = {
  featureFlags: EduFeatureFlags;
  hasRequiredEnv: boolean;
  entryBlocked: boolean;
  health?: WebllmBootstrapHealthGate | null;
  degradedBlocked?: boolean;
  baseEnabledOverride?: boolean;
};

const statusCodeMap: Record<WebLLMStatus, string> = {
  DISABLED: "WEBLLM_DISABLED",
  UNSUPPORTED: "WEBLLM_UNSUPPORTED",
  ENV_MISSING: "WEBLLM_ENV_MISSING",
  MODEL_ID_UNKNOWN: "WEBLLM_MODEL_ID_UNKNOWN",
  ASSET_UNREACHABLE: "WEBLLM_ASSET_UNREACHABLE",
  CORS_BLOCKED: "WEBLLM_CORS_BLOCKED",
  LOADING: "WEBLLM_LOADING",
  READY: "WEBLLM_READY",
  DEGRADED: "WEBLLM_DEGRADED",
  ERROR: "WEBLLM_ERROR",
};

const hasJoinTokenSessionReason = (featureFlags: EduFeatureFlags): boolean => {
  if (featureFlags.reason === "join_token_session") return true;
  return featureFlags.reasons?.includes("join_token_session") ?? false;
};

const resolveEnvSource = (): "runtime" | "build" | "unset" => {
  const keys = [
    "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
    "NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE",
    "NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE",
  ];
  for (const key of keys) {
    if (readWebllmEnvValueWithSource(key).source === "runtime") return "runtime";
  }
  for (const key of keys) {
    if (readWebllmEnvValueWithSource(key).source === "build") return "build";
  }
  return "unset";
};

export const resolveWebllmBootstrapPlan = (
  input: ResolveWebllmBootstrapPlanInput,
): WebllmBootstrapPlan => {
  const { featureFlags, hasRequiredEnv, entryBlocked, health, degradedBlocked = false } = input;
  const webllmEnableDecision = evaluateWebLLMEnablement({ featureFlags });
  const baseEnabled = input.baseEnabledOverride ?? webllmEnableDecision.enabled;
  const joinTokenSessionAllowed = hasJoinTokenSessionReason(featureFlags);
  const downloadAllowed = featureFlags.webllmDownloadAllowed !== false;
  const hardDisabled = health?.hardDisabled === true;

  const authError = featureFlags.reason === "unauthorized" || featureFlags.errorKind === "auth_error";
  const disabledBySsot =
    hardDisabled ||
    featureFlags.webllmFeatureEnabled === false ||
    featureFlags.webllmEnabled === false ||
    featureFlags.webllmDownloadAllowed === false ||
    (authError && !joinTokenSessionAllowed);

  const effectiveEnabled = baseEnabled && !disabledBySsot;

  const authRequired =
    !effectiveEnabled &&
    !joinTokenSessionAllowed &&
    authError &&
    (featureFlags.webllmEnabled === false ||
      featureFlags.webllmDownloadAllowed === false ||
      entryBlocked ||
      featureFlags.reason === "unauthorized");

  let reasonCategory: WebllmBootstrapReasonCategory = "ready";
  if (hardDisabled) reasonCategory = "hard_disabled";
  else if (!downloadAllowed) reasonCategory = entryBlocked ? "entry_blocked" : "download_blocked";
  else if (webllmEnableDecision.reasonCode === "flag_disabled") reasonCategory = "feature_flag_disabled";
  else if (webllmEnableDecision.reasonCode === "user_disabled") reasonCategory = "user_disabled";
  else if (authRequired) reasonCategory = "auth_required";
  else if (!hasRequiredEnv) reasonCategory = "env_missing";
  else if (degradedBlocked) reasonCategory = "degraded";
  else if (health?.ok === false) reasonCategory = "health_not_ok";

  const shouldAttemptLocalInit =
    effectiveEnabled &&
    hasRequiredEnv &&
    health?.ok !== false &&
    health?.hardDisabled !== true &&
    !degradedBlocked;

  const status: WebLLMStatus = !effectiveEnabled
    ? "DISABLED"
    : !hasRequiredEnv
      ? "ENV_MISSING"
      : degradedBlocked
        ? "DEGRADED"
        : "READY";

  const statusCode = statusCodeMap[status];
  const envSource = resolveEnvSource();

  return {
    baseEnabled,
    effectiveEnabled,
    hardDisabled,
    downloadAllowed,
    entryBlocked,
    hasRequiredEnv,
    envSource,
    healthOk: health?.ok ?? null,
    healthHardDisabled: health?.hardDisabled ?? null,
    degradedBlocked,
    status,
    statusCode,
    reasonCategory,
    authRequired,
    joinTokenSessionAllowed,
    shouldAttemptLocalInit,
    shouldUseServerFallback: !shouldAttemptLocalInit,
    webllmEnableDecision,
    debugSnapshot: {
      baseEnabled,
      effectiveEnabled,
      hardDisabled,
      downloadAllowed,
      entryBlocked,
      hasRequiredEnv,
      envSource,
      healthOk: health?.ok ?? null,
      healthHardDisabled: health?.hardDisabled ?? null,
      degradedBlocked,
      authRequired,
      joinTokenSessionAllowed,
      reasonCategory,
      statusCode,
    },
  };
};
