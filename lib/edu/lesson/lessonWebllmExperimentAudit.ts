import type {
  LessonWebllmDispatchDecisionReason,
  LessonWebllmDispatchSelectorResult,
} from "@/lib/edu/lesson/lessonWebllmDispatchSelector";
import type {
  LessonWebllmContainedDispatchPlan,
  LessonWebllmExperimentOutcome,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";

export type LessonWebllmExperimentAuditBlockCategory =
  | "none"
  | "allowlist"
  | "kill_switch"
  | "policy"
  | "preflight";

export type LessonWebllmExperimentAuditStage =
  | "rollout_blocked"
  | "eligible_no_attempt"
  | "dispatch_attempted";

export type LessonWebllmExperimentAuditResult = "no_attempt" | "fallback" | "success";

export type LessonWebllmExperimentAuditRecord = {
  inRolloutScope: boolean;
  blockCategory: LessonWebllmExperimentAuditBlockCategory;
  dispatchAttempted: boolean;
  fallbackOccurred: boolean;
  stage: LessonWebllmExperimentAuditStage;
  result: LessonWebllmExperimentAuditResult;
  reason: LessonWebllmDispatchDecisionReason | NonNullable<LessonWebllmExperimentOutcome["fallbackReason"]>;
};

export type ResolveLessonWebllmExperimentAuditInput = {
  selector: LessonWebllmDispatchSelectorResult;
  plan: LessonWebllmContainedDispatchPlan;
  outcome: LessonWebllmExperimentOutcome;
};

const mapBlockCategory = (
  selectorReason: LessonWebllmDispatchDecisionReason,
): LessonWebllmExperimentAuditBlockCategory => {
  if (selectorReason === "dispatch_kill_switch_on") return "kill_switch";
  if (selectorReason === "not_in_rollout_scope") return "allowlist";
  if (selectorReason === "preflight_ineligible") return "preflight";
  if (selectorReason !== "contained_dispatch_enabled") return "policy";
  return "none";
};

export const resolveLessonWebllmExperimentAuditRecord = (
  input: ResolveLessonWebllmExperimentAuditInput,
): LessonWebllmExperimentAuditRecord => {
  const inRolloutScope = input.selector.experimentScope === "in_scope_eligible" || input.selector.experimentScope === "in_scope_but_blocked" || input.selector.experimentScope === "opted_out";
  const blockCategory = mapBlockCategory(input.selector.reason);
  const dispatchAttempted = input.outcome.attemptState === "attempted";
  const fallbackOccurred = input.outcome.fallbackReason !== null;

  const result: LessonWebllmExperimentAuditResult = input.outcome.successReason
    ? "success"
    : fallbackOccurred
      ? "fallback"
      : "no_attempt";

  const stage: LessonWebllmExperimentAuditStage = dispatchAttempted
    ? "dispatch_attempted"
    : input.plan.attemptLocalDispatch
      ? "eligible_no_attempt"
      : "rollout_blocked";

  const reason =
    input.outcome.fallbackReason ??
    input.outcome.noAttemptReason ??
    input.selector.reason;

  return {
    inRolloutScope,
    blockCategory,
    dispatchAttempted,
    fallbackOccurred,
    stage,
    result,
    reason,
  };
};
