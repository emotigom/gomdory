import type { LessonWebllmActivationPreflight } from "@/lib/edu/lesson/lessonWebllmActivationPreflight";

export type LessonWebllmActivationExperimentMode = "off" | "observe_only" | "eligible_noop";

export type LessonWebllmActivationPolicyOutcome =
  | "globally_off"
  | "observe_only"
  | "eligible_noop_observed"
  | "eligible_noop_blocked";

export type ResolveLessonWebllmActivationPolicyInput = {
  effectiveWebllmEnabled: boolean;
  preflight: LessonWebllmActivationPreflight;
  activationExperimentModeRaw?: string | null;
};

export type LessonWebllmActivationPolicy = {
  mode: LessonWebllmActivationExperimentMode;
  outcome: LessonWebllmActivationPolicyOutcome;
  experimentReady: boolean;
  globallyOff: boolean;
  explicitOptInRequired: true;
  preflightEligible: boolean;
  noDispatchReason:
    | "global_policy_off"
    | "observe_only_mode"
    | "eligible_gate_blocked"
    | "eligible_but_no_dispatch_contract";
  guardrails: {
    preserveCurrentProviderRouting: true;
    preserveCoachDecorateMainline: true;
    activationOnlyObservational: true;
  };
};

const normalizeExperimentMode = (value?: string | null): LessonWebllmActivationExperimentMode => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "observe_only") return "observe_only";
  if (normalized === "eligible_noop") return "eligible_noop";
  return "off";
};

export const readLessonWebllmActivationExperimentMode = (): LessonWebllmActivationExperimentMode =>
  normalizeExperimentMode(process.env.NEXT_PUBLIC_EDU_WEBLLM_ACTIVATION_EXPERIMENT);

export const resolveLessonWebllmActivationPolicy = (
  input: ResolveLessonWebllmActivationPolicyInput,
): LessonWebllmActivationPolicy => {
  const mode = normalizeExperimentMode(input.activationExperimentModeRaw);
  const preflightEligible = input.preflight.eligibility === "eligible";
  const eligibleGate = input.effectiveWebllmEnabled && preflightEligible;
  const outcome: LessonWebllmActivationPolicyOutcome =
    mode === "off"
      ? "globally_off"
      : mode === "observe_only"
        ? "observe_only"
        : eligibleGate
          ? "eligible_noop_observed"
          : "eligible_noop_blocked";
  const noDispatchReason: LessonWebllmActivationPolicy["noDispatchReason"] =
    mode === "off"
      ? "global_policy_off"
      : mode === "observe_only"
        ? "observe_only_mode"
        : eligibleGate
          ? "eligible_but_no_dispatch_contract"
          : "eligible_gate_blocked";

  return {
    mode,
    outcome,
    experimentReady: outcome === "eligible_noop_observed",
    globallyOff: mode === "off",
    explicitOptInRequired: true,
    preflightEligible,
    noDispatchReason,
    guardrails: {
      preserveCurrentProviderRouting: true,
      preserveCoachDecorateMainline: true,
      activationOnlyObservational: true,
    },
  };
};
