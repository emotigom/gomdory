import assert from "node:assert/strict";
import test from "node:test";

import { resolveLessonWebllmActivationHook } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import { resolveLessonWebllmDispatchSelector } from "@/lib/edu/lesson/lessonWebllmDispatchSelector";
import { resolveLessonWebllmExperimentAuditRecord } from "@/lib/edu/lesson/lessonWebllmExperimentAudit";
import {
  resolveLessonWebllmContainedDispatchPlan,
  resolveLessonWebllmExperimentOutcome,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";

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

type Scenario = {
  name: string;
  activationExperimentModeRaw?: string;
  dispatchExperimentModeRaw?: string;
  dispatchKillSwitchRaw?: string;
  rolloutLessonAllowlistRaw?: string;
  lessonId?: number;
  effectiveWebllmEnabled: boolean;
  initialStatus: "READY" | "DEGRADED";
  degradedRetryAllowed: boolean;
  dispatchFailureReason?: "timeout";
  expect: {
    policyReason: string;
    selectorReason: string;
    dispatchMode: "openai_mainline" | "webllm_contained";
    attemptState: "no_attempt" | "attempted";
    auditStage: "rollout_blocked" | "dispatch_attempted";
    auditResult: "fallback" | "success";
    auditReason: string;
  };
};

const scenarios: Scenario[] = [
  {
    name: "globally off keeps mainline no-attempt fallback",
    activationExperimentModeRaw: "off",
    dispatchExperimentModeRaw: "contained_lesson_local",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
    effectiveWebllmEnabled: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
    expect: {
      policyReason: "global_policy_off",
      selectorReason: "activation_not_ready",
      dispatchMode: "openai_mainline",
      attemptState: "no_attempt",
      auditStage: "rollout_blocked",
      auditResult: "fallback",
      auditReason: "blocked",
    },
  },
  {
    name: "observe_only keeps observational policy with no dispatch",
    activationExperimentModeRaw: "observe_only",
    dispatchExperimentModeRaw: "contained_lesson_local",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
    effectiveWebllmEnabled: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
    expect: {
      policyReason: "observe_only_mode",
      selectorReason: "activation_not_ready",
      dispatchMode: "openai_mainline",
      attemptState: "no_attempt",
      auditStage: "rollout_blocked",
      auditResult: "fallback",
      auditReason: "blocked",
    },
  },
  {
    name: "allowlist missing keeps lesson out of rollout scope",
    activationExperimentModeRaw: "eligible_noop",
    dispatchExperimentModeRaw: "contained_lesson_local",
    effectiveWebllmEnabled: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
    expect: {
      policyReason: "eligible_but_no_dispatch_contract",
      selectorReason: "not_in_rollout_scope",
      dispatchMode: "openai_mainline",
      attemptState: "no_attempt",
      auditStage: "rollout_blocked",
      auditResult: "fallback",
      auditReason: "blocked",
    },
  },
  {
    name: "kill-switch on forces immediate off regardless of eligibility",
    activationExperimentModeRaw: "eligible_noop",
    dispatchExperimentModeRaw: "contained_lesson_local",
    dispatchKillSwitchRaw: "true",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
    effectiveWebllmEnabled: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
    expect: {
      policyReason: "eligible_but_no_dispatch_contract",
      selectorReason: "dispatch_kill_switch_on",
      dispatchMode: "openai_mainline",
      attemptState: "no_attempt",
      auditStage: "rollout_blocked",
      auditResult: "fallback",
      auditReason: "blocked",
    },
  },
  {
    name: "eligible but no-dispatch when runtime is degraded and retry is blocked",
    activationExperimentModeRaw: "eligible_noop",
    dispatchExperimentModeRaw: "contained_lesson_local",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
    effectiveWebllmEnabled: true,
    initialStatus: "DEGRADED",
    degradedRetryAllowed: false,
    expect: {
      policyReason: "eligible_but_no_dispatch_contract",
      selectorReason: "contained_dispatch_enabled",
      dispatchMode: "webllm_contained",
      attemptState: "no_attempt",
      auditStage: "rollout_blocked",
      auditResult: "fallback",
      auditReason: "degraded",
    },
  },
  {
    name: "in-scope eligible dispatch attempt falls back to mainline on timeout",
    activationExperimentModeRaw: "eligible_noop",
    dispatchExperimentModeRaw: "contained_lesson_local",
    rolloutLessonAllowlistRaw: "1",
    lessonId: 1,
    effectiveWebllmEnabled: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
    dispatchFailureReason: "timeout",
    expect: {
      policyReason: "eligible_but_no_dispatch_contract",
      selectorReason: "contained_dispatch_enabled",
      dispatchMode: "webllm_contained",
      attemptState: "attempted",
      auditStage: "dispatch_attempted",
      auditResult: "fallback",
      auditReason: "timeout",
    },
  },
];

test("B17 dry-run matrix keeps policy/selector/planner/audit contracts aligned", () => {
  for (const scenario of scenarios) {
    const activationHook = resolveLessonWebllmActivationHook({
      effectiveWebllmEnabled: scenario.effectiveWebllmEnabled,
      preflight: eligiblePreflight,
      activationExperimentModeRaw: scenario.activationExperimentModeRaw,
    });

    const selector = resolveLessonWebllmDispatchSelector({
      activationHook,
      dispatchExperimentModeRaw: scenario.dispatchExperimentModeRaw,
      dispatchKillSwitchRaw: scenario.dispatchKillSwitchRaw,
      rolloutLessonAllowlistRaw: scenario.rolloutLessonAllowlistRaw,
      lessonId: scenario.lessonId,
    });

    const plan = resolveLessonWebllmContainedDispatchPlan({
      bootstrapReady: true,
      canonicalAssetReady: true,
      effectiveWebllmEnabled: activationHook.effectiveWebllmEnabled,
      wouldDispatchToWebllm: selector.wouldDispatchToWebllm,
      initialStatus: scenario.initialStatus,
      degradedRetryAllowed: scenario.degradedRetryAllowed,
    });

    const outcome = resolveLessonWebllmExperimentOutcome({
      plan,
      dispatchFailureReason: scenario.dispatchFailureReason,
      localDispatchSucceeded: false,
    });

    const audit = resolveLessonWebllmExperimentAuditRecord({
      selector,
      plan,
      outcome,
    });

    assert.equal(activationHook.activationExperiment.noDispatchReason, scenario.expect.policyReason, scenario.name);
    assert.equal(selector.reason, scenario.expect.selectorReason, scenario.name);
    assert.equal(selector.dispatchMode, scenario.expect.dispatchMode, scenario.name);
    assert.equal(outcome.attemptState, scenario.expect.attemptState, scenario.name);
    assert.equal(audit.stage, scenario.expect.auditStage, scenario.name);
    assert.equal(audit.result, scenario.expect.auditResult, scenario.name);
    assert.equal(audit.reason, scenario.expect.auditReason, scenario.name);
  }
});
