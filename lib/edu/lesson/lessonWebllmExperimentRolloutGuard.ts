import type { LessonWebllmActivationHookResult } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import type {
  LessonWebllmDispatchDecisionReason,
  LessonWebllmDispatchExperimentMode,
} from "@/lib/edu/lesson/lessonWebllmDispatchSelector";

export type LessonWebllmExperimentScopeResult =
  | "off"
  | "opted_out"
  | "not_in_scope"
  | "in_scope_but_blocked"
  | "in_scope_eligible";

export type ResolveLessonWebllmExperimentRolloutGuardInput = {
  dispatchExperimentMode: LessonWebllmDispatchExperimentMode;
  activationHook: LessonWebllmActivationHookResult;
  lessonId?: number | null;
  dispatchKillSwitchRaw?: string | null;
  rolloutLessonAllowlistRaw?: string | null;
};

export type LessonWebllmExperimentRolloutGuardDecision = {
  scope: LessonWebllmExperimentScopeResult;
  reason: LessonWebllmDispatchDecisionReason;
  inRolloutScope: boolean;
};

const normalizeBooleanFlag = (value?: string | null): boolean => {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
};

const parseLessonAllowlist = (value?: string | null): Set<number> => {
  const entries = (value ?? "")
    .split(",")
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((token) => Number.isFinite(token));
  return new Set(entries);
};

const hasConfiguredLessonAllowlist = (value?: string | null): boolean => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0;
};

const isLessonInScope = (lessonId: number | null | undefined, allowlist: Set<number>): boolean => {
  if (allowlist.size === 0) return true;
  if (!Number.isFinite(lessonId)) return false;
  return allowlist.has(Number(lessonId));
};

export const readLessonWebllmDispatchKillSwitch = (): boolean =>
  normalizeBooleanFlag(process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_KILL_SWITCH);

export const readLessonWebllmDispatchLessonAllowlistRaw = (): string | undefined => {
  const raw = process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_LESSON_ALLOWLIST;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
};

export const resolveLessonWebllmExperimentRolloutGuard = (
  input: ResolveLessonWebllmExperimentRolloutGuardInput,
): LessonWebllmExperimentRolloutGuardDecision => {
  if (input.dispatchExperimentMode === "off") {
    return {
      scope: "off",
      reason: "dispatch_experiment_off",
      inRolloutScope: false,
    };
  }

  if (normalizeBooleanFlag(input.dispatchKillSwitchRaw)) {
    return {
      scope: "off",
      reason: "dispatch_kill_switch_on",
      inRolloutScope: false,
    };
  }

  if (!hasConfiguredLessonAllowlist(input.rolloutLessonAllowlistRaw)) {
    return {
      scope: "not_in_scope",
      reason: "default_mainline",
      inRolloutScope: false,
    };
  }

  const allowlist = parseLessonAllowlist(input.rolloutLessonAllowlistRaw);
  const inScope = isLessonInScope(input.lessonId, allowlist);

  if (!inScope) {
    return {
      scope: "not_in_scope",
      reason: "default_mainline",
      inRolloutScope: false,
    };
  }

  if (!input.activationHook.effectiveWebllmEnabled) {
    return {
      scope: "opted_out",
      reason: "effective_webllm_disabled",
      inRolloutScope: true,
    };
  }

  if (!input.activationHook.activationExperiment.experimentReady) {
    return {
      scope: "in_scope_but_blocked",
      reason: "activation_not_ready",
      inRolloutScope: true,
    };
  }

  if (input.activationHook.activationExperiment.candidateEligibility !== "eligible") {
    return {
      scope: "in_scope_but_blocked",
      reason: "preflight_ineligible",
      inRolloutScope: true,
    };
  }

  if (input.activationHook.activationExperiment.hardBlockers.length > 0) {
    return {
      scope: "in_scope_but_blocked",
      reason: "hard_blockers_present",
      inRolloutScope: true,
    };
  }

  return {
    scope: "in_scope_eligible",
    reason: "contained_dispatch_enabled",
    inRolloutScope: true,
  };
};
