import type { LessonWebllmActivationHookResult } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import {
  readLessonWebllmDispatchKillSwitch,
  readLessonWebllmDispatchLessonAllowlistRaw,
  resolveLessonWebllmExperimentRolloutGuard,
  type LessonWebllmExperimentScopeResult,
} from "@/lib/edu/lesson/lessonWebllmExperimentRolloutGuard";

export type LessonWebllmDispatchExperimentMode = "off" | "contained_lesson_local";

export type LessonWebllmDispatchMode = "openai_mainline" | "webllm_contained";

export type LessonWebllmDispatchDecisionReason =
  | "default_mainline"
  | "dispatch_experiment_off"
  | "dispatch_kill_switch_on"
  | "not_in_rollout_scope"
  | "activation_not_ready"
  | "preflight_ineligible"
  | "hard_blockers_present"
  | "effective_webllm_disabled"
  | "contained_dispatch_enabled";

export type LessonWebllmDispatchSelectorResult = {
  dispatchMode: LessonWebllmDispatchMode;
  wouldDispatchToWebllm: boolean;
  reason: LessonWebllmDispatchDecisionReason;
  experimentScope: LessonWebllmExperimentScopeResult;
  guardrails: {
    explicitOptInRequired: true;
    preserveCoachDecorateMainline: true;
    rollbackSafeDefaultMainline: true;
    explicitDispatchKillSwitch: true;
    boundedLessonRolloutScope: true;
  };
};

export type ResolveLessonWebllmDispatchSelectorInput = {
  activationHook: LessonWebllmActivationHookResult;
  dispatchExperimentModeRaw?: string | null;
  lessonId?: number | null;
  dispatchKillSwitchRaw?: string | null;
  rolloutLessonAllowlistRaw?: string | null;
};

const normalizeDispatchExperimentMode = (
  value?: string | null,
): LessonWebllmDispatchExperimentMode => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "contained_lesson_local") return "contained_lesson_local";
  return "off";
};

export const readLessonWebllmDispatchExperimentMode = (): LessonWebllmDispatchExperimentMode =>
  normalizeDispatchExperimentMode(process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_EXPERIMENT);

export const resolveLessonWebllmDispatchSelector = (
  input: ResolveLessonWebllmDispatchSelectorInput,
): LessonWebllmDispatchSelectorResult => {
  const dispatchMode = normalizeDispatchExperimentMode(input.dispatchExperimentModeRaw);
  const rolloutGuard = resolveLessonWebllmExperimentRolloutGuard({
    dispatchExperimentMode: dispatchMode,
    activationHook: input.activationHook,
    lessonId: input.lessonId,
    dispatchKillSwitchRaw: input.dispatchKillSwitchRaw,
    rolloutLessonAllowlistRaw: input.rolloutLessonAllowlistRaw,
  });

  if (rolloutGuard.scope === "off") {
    return {
      dispatchMode: "openai_mainline",
      wouldDispatchToWebllm: false,
      reason: rolloutGuard.reason,
      experimentScope: rolloutGuard.scope,
      guardrails: {
        explicitOptInRequired: true,
        preserveCoachDecorateMainline: true,
        rollbackSafeDefaultMainline: true,
        explicitDispatchKillSwitch: true,
        boundedLessonRolloutScope: true,
      },
    };
  }

  if (rolloutGuard.scope === "not_in_scope") {
    return {
      dispatchMode: "openai_mainline",
      wouldDispatchToWebllm: false,
      reason: "not_in_rollout_scope",
      experimentScope: rolloutGuard.scope,
      guardrails: {
        explicitOptInRequired: true,
        preserveCoachDecorateMainline: true,
        rollbackSafeDefaultMainline: true,
        explicitDispatchKillSwitch: true,
        boundedLessonRolloutScope: true,
      },
    };
  }

  if (rolloutGuard.scope !== "in_scope_eligible") {
    return {
      dispatchMode: "openai_mainline",
      wouldDispatchToWebllm: false,
      reason: rolloutGuard.reason,
      experimentScope: rolloutGuard.scope,
      guardrails: {
        explicitOptInRequired: true,
        preserveCoachDecorateMainline: true,
        rollbackSafeDefaultMainline: true,
        explicitDispatchKillSwitch: true,
        boundedLessonRolloutScope: true,
      },
    };
  }

  return {
    dispatchMode: "webllm_contained",
    wouldDispatchToWebllm: true,
    reason: "contained_dispatch_enabled",
    experimentScope: rolloutGuard.scope,
    guardrails: {
      explicitOptInRequired: true,
      preserveCoachDecorateMainline: true,
      rollbackSafeDefaultMainline: true,
      explicitDispatchKillSwitch: true,
      boundedLessonRolloutScope: true,
    },
  };
};

export const readLessonWebllmDispatchKillSwitchEnabled = (): boolean => readLessonWebllmDispatchKillSwitch();

export const readLessonWebllmDispatchRolloutLessonAllowlistRaw = (): string | undefined =>
  readLessonWebllmDispatchLessonAllowlistRaw();
