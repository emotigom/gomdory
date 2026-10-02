import type { LessonWebllmActivationPreflight } from "@/lib/edu/lesson/lessonWebllmActivationPreflight";
import {
  resolveLessonWebllmActivationPolicy,
  type LessonWebllmActivationExperimentMode,
  type LessonWebllmActivationPolicyOutcome,
} from "@/lib/edu/lesson/lessonWebllmActivationPolicy";

export type LessonWebllmActivationHookResult = {
  effectiveWebllmEnabled: boolean;
  activationExperiment: {
    state: "globally_off" | "observe_only" | "eligible_no_dispatch";
    mode: LessonWebllmActivationExperimentMode;
    policyOutcome: LessonWebllmActivationPolicyOutcome;
    experimentReady: boolean;
    noDispatchReason:
      | "global_policy_off"
      | "observe_only_mode"
      | "eligible_gate_blocked"
      | "eligible_but_no_dispatch_contract";
    /**
     * Explicit B8 insertion point:
     * future contained experiments can branch on preflight eligibility,
     * but B8 must preserve baseline provider routing exactly.
     */
    candidateEligibility: LessonWebllmActivationPreflight["eligibility"];
    hardBlockers: LessonWebllmActivationPreflight["hardBlockers"];
  };
};

export type ResolveLessonWebllmActivationHookInput = {
  effectiveWebllmEnabled: boolean;
  preflight: LessonWebllmActivationPreflight;
  activationExperimentModeRaw?: string | null;
};

export const resolveLessonWebllmActivationHook = (
  input: ResolveLessonWebllmActivationHookInput,
): LessonWebllmActivationHookResult => {
  const policy = resolveLessonWebllmActivationPolicy(input);

  // B8 no-op contract:
  // read activation preflight + policy for observability/composition only,
  // keep current routing signal unchanged.
  return {
    effectiveWebllmEnabled: input.effectiveWebllmEnabled,
    activationExperiment: {
      state:
        policy.outcome === "globally_off"
          ? "globally_off"
          : policy.outcome === "observe_only"
            ? "observe_only"
            : "eligible_no_dispatch",
      mode: policy.mode,
      policyOutcome: policy.outcome,
      experimentReady: policy.experimentReady,
      noDispatchReason: policy.noDispatchReason,
      candidateEligibility: input.preflight.eligibility,
      hardBlockers: [...input.preflight.hardBlockers],
    },
  };
};
