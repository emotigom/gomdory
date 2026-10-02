import assert from "node:assert/strict";
import test from "node:test";

import {
  readLessonWebllmActivationExperimentMode,
  resolveLessonWebllmActivationPolicy,
} from "@/lib/edu/lesson/lessonWebllmActivationPolicy";

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

test("activation policy defaults to globally off without explicit mode", () => {
  const policy = resolveLessonWebllmActivationPolicy({
    effectiveWebllmEnabled: true,
    preflight: eligiblePreflight,
    activationExperimentModeRaw: undefined,
  });

  assert.equal(policy.mode, "off");
  assert.equal(policy.outcome, "globally_off");
  assert.equal(policy.globallyOff, true);
  assert.equal(policy.preflightEligible, true);
  assert.equal(policy.experimentReady, false);
  assert.equal(policy.noDispatchReason, "global_policy_off");
});

test("activation policy observe_only stays observational regardless of eligibility", () => {
  const policy = resolveLessonWebllmActivationPolicy({
    effectiveWebllmEnabled: false,
    preflight: { ...eligiblePreflight, eligibility: "ineligible", hardBlockers: ["env_missing"] },
    activationExperimentModeRaw: "observe_only",
  });

  assert.equal(policy.mode, "observe_only");
  assert.equal(policy.outcome, "observe_only");
  assert.equal(policy.globallyOff, false);
  assert.equal(policy.preflightEligible, false);
  assert.equal(policy.experimentReady, false);
  assert.equal(policy.noDispatchReason, "observe_only_mode");
});

test("activation policy eligible_noop reflects preflight + gate as observational branch", () => {
  const eligible = resolveLessonWebllmActivationPolicy({
    effectiveWebllmEnabled: true,
    preflight: eligiblePreflight,
    activationExperimentModeRaw: "eligible_noop",
  });
  assert.equal(eligible.outcome, "eligible_noop_observed");
  assert.equal(eligible.experimentReady, true);
  assert.equal(eligible.noDispatchReason, "eligible_but_no_dispatch_contract");

  const blocked = resolveLessonWebllmActivationPolicy({
    effectiveWebllmEnabled: false,
    preflight: eligiblePreflight,
    activationExperimentModeRaw: "eligible_noop",
  });
  assert.equal(blocked.outcome, "eligible_noop_blocked");
  assert.equal(blocked.experimentReady, false);
  assert.equal(blocked.noDispatchReason, "eligible_gate_blocked");
});

test("activation policy env reader normalizes unknown value to off", () => {
  const prev = process.env.NEXT_PUBLIC_EDU_WEBLLM_ACTIVATION_EXPERIMENT;
  try {
    process.env.NEXT_PUBLIC_EDU_WEBLLM_ACTIVATION_EXPERIMENT = "weird_mode";
    assert.equal(readLessonWebllmActivationExperimentMode(), "off");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_EDU_WEBLLM_ACTIVATION_EXPERIMENT;
    else process.env.NEXT_PUBLIC_EDU_WEBLLM_ACTIVATION_EXPERIMENT = prev;
  }
});
