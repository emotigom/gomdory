import assert from "node:assert/strict";
import test from "node:test";

import { resolveLessonWebllmActivationHook } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import { resolveLessonWebllmDispatchSelector } from "@/lib/edu/lesson/lessonWebllmDispatchSelector";
import { resolveLessonWebllmExperimentAuditRecord } from "@/lib/edu/lesson/lessonWebllmExperimentAudit";
import {
  resolveLessonWebllmContainedDispatchPlan,
  resolveLessonWebllmExperimentOutcome,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";
import {
  evaluateLessonWebllmWidenRolloutReadiness,
  resolveLessonWebllmRolloutOperatorDecision,
} from "@/lib/edu/lesson/lessonWebllmRolloutCriteria";

const eligiblePreflight = {
  eligibility: "eligible" as const,
  hardBlockers: [],
  requiredConditions: {
    hasWebllmEnvEffective: true,
    hasModelHost: true,
    hasWasmHost: true,
    hasModelSelectionMetadata: true,
  },
  guardrails: {
    keepCoachDecorateMainline: true,
    webllmContainedNoProviderSwitch: true,
    noTelemetryContractChange: true,
  },
};

test("B18 operator decision contract maps audit outcomes to rollout actions", () => {
  const blockedActivation = resolveLessonWebllmActivationHook({
    effectiveWebllmEnabled: true,
    preflight: eligiblePreflight,
    activationExperimentModeRaw: "off",
  });
  const blockedSelector = resolveLessonWebllmDispatchSelector({
    activationHook: blockedActivation,
    dispatchExperimentModeRaw: "contained_lesson_local",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
  });
  const blockedPlan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: blockedActivation.effectiveWebllmEnabled,
    wouldDispatchToWebllm: blockedSelector.wouldDispatchToWebllm,
    initialStatus: "READY",
    degradedRetryAllowed: true,
  });
  const blockedOutcome = resolveLessonWebllmExperimentOutcome({
    plan: blockedPlan,
    localDispatchSucceeded: false,
  });
  const blockedAudit = resolveLessonWebllmExperimentAuditRecord({
    selector: blockedSelector,
    plan: blockedPlan,
    outcome: blockedOutcome,
  });
  assert.equal(resolveLessonWebllmRolloutOperatorDecision(blockedAudit), "mainline_only_expected");

  const cautionActivation = resolveLessonWebllmActivationHook({
    effectiveWebllmEnabled: true,
    preflight: eligiblePreflight,
    activationExperimentModeRaw: "eligible_noop",
  });
  const cautionSelector = resolveLessonWebllmDispatchSelector({
    activationHook: cautionActivation,
    dispatchExperimentModeRaw: "contained_lesson_local",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
  });
  const cautionPlan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: cautionActivation.effectiveWebllmEnabled,
    wouldDispatchToWebllm: cautionSelector.wouldDispatchToWebllm,
    initialStatus: "READY",
    degradedRetryAllowed: true,
  });
  const cautionOutcome = resolveLessonWebllmExperimentOutcome({
    plan: cautionPlan,
    dispatchFailureReason: "timeout",
    localDispatchSucceeded: false,
  });
  const cautionAudit = resolveLessonWebllmExperimentAuditRecord({
    selector: cautionSelector,
    plan: cautionPlan,
    outcome: cautionOutcome,
  });
  assert.equal(resolveLessonWebllmRolloutOperatorDecision(cautionAudit), "continue_with_caution");

  const stopOutcome = resolveLessonWebllmExperimentOutcome({
    plan: cautionPlan,
    dispatchFailureReason: "engine_error",
    localDispatchSucceeded: false,
  });
  const stopAudit = resolveLessonWebllmExperimentAuditRecord({
    selector: cautionSelector,
    plan: cautionPlan,
    outcome: stopOutcome,
  });
  assert.equal(resolveLessonWebllmRolloutOperatorDecision(stopAudit), "immediate_stop");

  const successOutcome = resolveLessonWebllmExperimentOutcome({
    plan: cautionPlan,
    localDispatchSucceeded: true,
  });
  const successAudit = resolveLessonWebllmExperimentAuditRecord({
    selector: cautionSelector,
    plan: cautionPlan,
    outcome: successOutcome,
  });
  assert.equal(resolveLessonWebllmRolloutOperatorDecision(successAudit), "entry_allowed");
});

test("B18 widen-rollout readiness requires clean window plus operational checkpoints", () => {
  const ready = evaluateLessonWebllmWidenRolloutReadiness({
    attemptedDispatches: 5,
    fallbackCount: 0,
    engineErrorCount: 0,
    noResponseCount: 0,
    timeoutCount: 0,
    coachDecorateRegressionReported: false,
    rollbackDrillCompleted: true,
    auditMappingReviewed: true,
  });
  assert.equal(ready.canWidenRollout, true);
  assert.deepEqual(ready.unmetReasons, []);

  const blocked = evaluateLessonWebllmWidenRolloutReadiness({
    attemptedDispatches: 0,
    fallbackCount: 1,
    engineErrorCount: 1,
    noResponseCount: 0,
    timeoutCount: 1,
    coachDecorateRegressionReported: true,
    rollbackDrillCompleted: false,
    auditMappingReviewed: false,
  });

  assert.equal(blocked.canWidenRollout, false);
  assert.deepEqual(blocked.unmetReasons, [
    "no_dispatch_attempts_in_window",
    "fallbacks_observed_in_window",
    "engine_error_or_no_response_observed",
    "coach_decorate_regression_reported",
    "rollback_drill_incomplete",
    "audit_mapping_review_incomplete",
  ]);
});
