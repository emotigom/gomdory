import type { LessonWebllmExperimentAuditRecord } from "@/lib/edu/lesson/lessonWebllmExperimentAudit";

export type LessonWebllmRolloutOperatorDecision =
  | "entry_allowed"
  | "immediate_stop"
  | "continue_with_caution"
  | "mainline_only_expected";

export type LessonWebllmWidenRolloutEvaluationInput = {
  attemptedDispatches: number;
  fallbackCount: number;
  engineErrorCount: number;
  noResponseCount: number;
  timeoutCount: number;
  coachDecorateRegressionReported: boolean;
  rollbackDrillCompleted: boolean;
  auditMappingReviewed: boolean;
};

export type LessonWebllmWidenRolloutUnmetReason =
  | "no_dispatch_attempts_in_window"
  | "fallbacks_observed_in_window"
  | "engine_error_or_no_response_observed"
  | "coach_decorate_regression_reported"
  | "rollback_drill_incomplete"
  | "audit_mapping_review_incomplete";

export type LessonWebllmWidenRolloutEvaluation = {
  canWidenRollout: boolean;
  unmetReasons: LessonWebllmWidenRolloutUnmetReason[];
};

const isImmediateStopFallbackReason = (reason: LessonWebllmExperimentAuditRecord["reason"]): boolean =>
  reason === "engine_error" || reason === "no_response";

export const resolveLessonWebllmRolloutOperatorDecision = (
  audit: LessonWebllmExperimentAuditRecord,
): LessonWebllmRolloutOperatorDecision => {
  if (audit.stage === "dispatch_attempted" && audit.result === "fallback" && isImmediateStopFallbackReason(audit.reason)) {
    return "immediate_stop";
  }

  if (audit.stage === "dispatch_attempted" && audit.result === "fallback") {
    return "continue_with_caution";
  }

  if (audit.stage === "dispatch_attempted" && audit.result === "success") {
    return "entry_allowed";
  }

  return "mainline_only_expected";
};

export const evaluateLessonWebllmWidenRolloutReadiness = (
  input: LessonWebllmWidenRolloutEvaluationInput,
): LessonWebllmWidenRolloutEvaluation => {
  const unmetReasons: LessonWebllmWidenRolloutUnmetReason[] = [];

  if (input.attemptedDispatches < 1) {
    unmetReasons.push("no_dispatch_attempts_in_window");
  }

  if (input.fallbackCount > 0 || input.timeoutCount > 0) {
    unmetReasons.push("fallbacks_observed_in_window");
  }

  if (input.engineErrorCount > 0 || input.noResponseCount > 0) {
    unmetReasons.push("engine_error_or_no_response_observed");
  }

  if (input.coachDecorateRegressionReported) {
    unmetReasons.push("coach_decorate_regression_reported");
  }

  if (!input.rollbackDrillCompleted) {
    unmetReasons.push("rollback_drill_incomplete");
  }

  if (!input.auditMappingReviewed) {
    unmetReasons.push("audit_mapping_review_incomplete");
  }

  return {
    canWidenRollout: unmetReasons.length === 0,
    unmetReasons,
  };
};
