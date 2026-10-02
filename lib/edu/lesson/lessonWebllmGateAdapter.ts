import type { EduFeatureFlags } from "@/lib/edu/featureFlags";
import { resolveWebllmBootstrapPlan, type WebllmBootstrapPlan } from "@/lib/edu/llm/webllmBootstrapPlan";
import type { WebllmHealthGate } from "@/lib/edu/llm/webllmClientGate";

export type LessonWebllmGateHealthState = WebllmHealthGate & {
  primary?: { modelConfigUrl?: string; selectedWasmUrl?: string | null; wasmCandidateUrls?: string[] } | null;
  coach?: { modelId?: string | null } | null;
  canonicalStatus?: "WEBLLM_READY" | "WEBLLM_ENV_MISSING" | "WEBLLM_DERIVED_URL_INVALID" | string | null;
  invalidReasons?: string[] | null;
};

type ResolveLessonWebllmGateInput = {
  featureFlags: EduFeatureFlags;
  hasWebllmEnv: boolean;
  entryBlocked: boolean;
  health: LessonWebllmGateHealthState | null;
  degradedBlocked?: boolean;
};

export type ResolveLessonWebllmGateResult = {
  bootstrapPlan: WebllmBootstrapPlan;
  webllmEnableDecision: WebllmBootstrapPlan["webllmEnableDecision"];
  webllmSsotDisabled: boolean;
  effectiveWebllmEnabled: boolean;
  hasWebllmEnvEffective: boolean;
  featureFlagsUnavailable: boolean;
  webllmAuthRequired: boolean;
};

export const resolveLessonWebllmGate = (
  input: ResolveLessonWebllmGateInput,
): ResolveLessonWebllmGateResult => {
  const { featureFlags, hasWebllmEnv, entryBlocked, health, degradedBlocked = false } = input;

  const bootstrapPlan = resolveWebllmBootstrapPlan({
    featureFlags,
    hasRequiredEnv: hasWebllmEnv,
    entryBlocked,
    health,
    degradedBlocked,
  });

  const hasWebllmEnvEffective = hasWebllmEnv || (health?.ok === true && health.hardDisabled !== true);
  const featureFlagsUnavailable =
    featureFlags.reason === "timeout" ||
    featureFlags.reason === "network_error" ||
    featureFlags.reason === "request_failed" ||
    featureFlags.reason === "unauthorized";
  const webllmAuthRequired = featureFlags.reason === "unauthorized" || bootstrapPlan.authRequired;

  return {
    bootstrapPlan,
    webllmEnableDecision: bootstrapPlan.webllmEnableDecision,
    webllmSsotDisabled: bootstrapPlan.hardDisabled || !bootstrapPlan.effectiveEnabled,
    effectiveWebllmEnabled: bootstrapPlan.effectiveEnabled,
    hasWebllmEnvEffective,
    featureFlagsUnavailable,
    webllmAuthRequired,
  };
};
