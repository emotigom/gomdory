import assert from "node:assert/strict";
import test from "node:test";

import { resolveLessonWebllmActivationHook } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import { resolveLessonWebllmDispatchSelector } from "@/lib/edu/lesson/lessonWebllmDispatchSelector";
import { resolveLessonWebllmExperimentAuditRecord } from "@/lib/edu/lesson/lessonWebllmExperimentAudit";
import {
  resolveLessonWebllmContainedDispatchPlan,
  resolveLessonWebllmExperimentOutcome,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";
import { resolveLessonWebllmRolloutOperatorDecision } from "@/lib/edu/lesson/lessonWebllmRolloutCriteria";

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

const b19MinimalFirstEnableBundle = {
  activationExperimentModeRaw: "eligible_noop",
  dispatchExperimentModeRaw: "contained_lesson_local",
  rolloutLessonAllowlistRaw: "1",
  dispatchKillSwitchRaw: "false",
};

const runAcceptanceFlow = (input: {
  lessonId: number;
  dispatchKillSwitchRaw?: string;
  dispatchFailureReason?: "timeout" | "engine_error" | "no_response";
  localDispatchSucceeded?: boolean;
  activationExperimentModeRaw?: string;
  dispatchExperimentModeRaw?: string;
}) => {
  const activationHook = resolveLessonWebllmActivationHook({
    effectiveWebllmEnabled: true,
    preflight: eligiblePreflight,
    activationExperimentModeRaw: input.activationExperimentModeRaw ?? b19MinimalFirstEnableBundle.activationExperimentModeRaw,
  });

  const selector = resolveLessonWebllmDispatchSelector({
    activationHook,
    dispatchExperimentModeRaw: input.dispatchExperimentModeRaw ?? b19MinimalFirstEnableBundle.dispatchExperimentModeRaw,
    dispatchKillSwitchRaw: input.dispatchKillSwitchRaw ?? b19MinimalFirstEnableBundle.dispatchKillSwitchRaw,
    rolloutLessonAllowlistRaw: b19MinimalFirstEnableBundle.rolloutLessonAllowlistRaw,
    lessonId: input.lessonId,
  });

  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: activationHook.effectiveWebllmEnabled,
    wouldDispatchToWebllm: selector.wouldDispatchToWebllm,
    initialStatus: "READY",
    degradedRetryAllowed: true,
  });

  const outcome = resolveLessonWebllmExperimentOutcome({
    plan,
    dispatchFailureReason: input.dispatchFailureReason,
    localDispatchSucceeded: input.localDispatchSucceeded,
  });

  const audit = resolveLessonWebllmExperimentAuditRecord({
    selector,
    plan,
    outcome,
  });

  return {
    selector,
    audit,
    operatorDecision: resolveLessonWebllmRolloutOperatorDecision(audit),
  };
};

test("B20 first-run acceptance verifies B19 minimal enable bundle and allowlist scope", () => {
  const nonAllowlisted = runAcceptanceFlow({ lessonId: 2 });

  assert.equal(nonAllowlisted.selector.reason, "not_in_rollout_scope");
  assert.equal(nonAllowlisted.selector.dispatchMode, "openai_mainline");
  assert.deepEqual(
    {
      stage: nonAllowlisted.audit.stage,
      result: nonAllowlisted.audit.result,
      reason: nonAllowlisted.audit.reason,
    },
    {
      stage: "rollout_blocked",
      result: "fallback",
      reason: "blocked",
    },
  );
  assert.equal(nonAllowlisted.operatorDecision, "mainline_only_expected");

  const allowlistedTimeout = runAcceptanceFlow({
    lessonId: 1,
    dispatchFailureReason: "timeout",
  });

  assert.equal(allowlistedTimeout.selector.reason, "contained_dispatch_enabled");
  assert.equal(allowlistedTimeout.selector.dispatchMode, "webllm_contained");
  assert.deepEqual(
    {
      stage: allowlistedTimeout.audit.stage,
      result: allowlistedTimeout.audit.result,
      reason: allowlistedTimeout.audit.reason,
    },
    {
      stage: "dispatch_attempted",
      result: "fallback",
      reason: "timeout",
    },
  );
  assert.equal(allowlistedTimeout.operatorDecision, "continue_with_caution");
});

test("B20 first-run acceptance verifies expected initial audit/decision outcomes", () => {
  const allowlistedEngineError = runAcceptanceFlow({
    lessonId: 1,
    dispatchFailureReason: "engine_error",
  });
  assert.equal(allowlistedEngineError.audit.reason, "engine_error");
  assert.equal(allowlistedEngineError.operatorDecision, "immediate_stop");

  const allowlistedNoResponse = runAcceptanceFlow({
    lessonId: 1,
    dispatchFailureReason: "no_response",
  });
  assert.equal(allowlistedNoResponse.audit.reason, "no_response");
  assert.equal(allowlistedNoResponse.operatorDecision, "immediate_stop");

  const allowlistedSuccess = runAcceptanceFlow({
    lessonId: 1,
    localDispatchSucceeded: true,
  });
  assert.deepEqual(
    {
      stage: allowlistedSuccess.audit.stage,
      result: allowlistedSuccess.audit.result,
      reason: allowlistedSuccess.audit.reason,
    },
    {
      stage: "dispatch_attempted",
      result: "success",
      reason: "contained_dispatch_enabled",
    },
  );
  assert.equal(allowlistedSuccess.operatorDecision, "entry_allowed");
});

test("B20 first-run acceptance verifies rollback/disable returns to mainline-only expectations", () => {
  const rollbackKillSwitch = runAcceptanceFlow({
    lessonId: 1,
    dispatchKillSwitchRaw: "true",
  });

  assert.equal(rollbackKillSwitch.selector.reason, "dispatch_kill_switch_on");
  assert.equal(rollbackKillSwitch.selector.dispatchMode, "openai_mainline");
  assert.equal(rollbackKillSwitch.audit.stage, "rollout_blocked");
  assert.equal(rollbackKillSwitch.audit.result, "fallback");
  assert.equal(rollbackKillSwitch.operatorDecision, "mainline_only_expected");

  const disableActivation = runAcceptanceFlow({
    lessonId: 1,
    activationExperimentModeRaw: "off",
  });

  assert.equal(disableActivation.selector.reason, "activation_not_ready");
  assert.equal(disableActivation.selector.dispatchMode, "openai_mainline");
  assert.equal(disableActivation.audit.stage, "rollout_blocked");
  assert.equal(disableActivation.operatorDecision, "mainline_only_expected");

  const disableDispatchMode = runAcceptanceFlow({
    lessonId: 1,
    dispatchExperimentModeRaw: "off",
  });

  assert.equal(disableDispatchMode.selector.reason, "dispatch_experiment_off");
  assert.equal(disableDispatchMode.selector.dispatchMode, "openai_mainline");
  assert.equal(disableDispatchMode.audit.stage, "rollout_blocked");
  assert.equal(disableDispatchMode.operatorDecision, "mainline_only_expected");
});
