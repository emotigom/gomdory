import assert from "node:assert/strict";
import test from "node:test";

import { resolveLessonWebllmActivationHook } from "@/lib/edu/lesson/lessonWebllmActivationHook";

test("activation hook keeps effective webllm gate unchanged for eligible preflight", () => {
  const result = resolveLessonWebllmActivationHook({
    effectiveWebllmEnabled: true,
    preflight: {
      eligibility: "eligible",
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
    },
    activationExperimentModeRaw: "eligible_noop",
  });

  assert.equal(result.effectiveWebllmEnabled, true);
  assert.equal(result.activationExperiment.state, "eligible_no_dispatch");
  assert.equal(result.activationExperiment.mode, "eligible_noop");
  assert.equal(result.activationExperiment.policyOutcome, "eligible_noop_observed");
  assert.equal(result.activationExperiment.experimentReady, true);
  assert.equal(result.activationExperiment.noDispatchReason, "eligible_but_no_dispatch_contract");
  assert.equal(result.activationExperiment.candidateEligibility, "eligible");
  assert.deepEqual(result.activationExperiment.hardBlockers, []);
});

test("activation hook remains noop and mirrors hard blockers without changing gate", () => {
  const result = resolveLessonWebllmActivationHook({
    effectiveWebllmEnabled: false,
    preflight: {
      eligibility: "ineligible",
      hardBlockers: ["auth_required", "ssot_disabled"],
      requiredConditions: {
        hasWebllmEnvEffective: true,
        hasModelHost: false,
        hasWasmHost: false,
        hasModelSelectionMetadata: true,
      },
      guardrails: {
        keepCoachDecorateMainline: true,
        webllmContainedNoProviderSwitch: true,
        noTelemetryContractChange: true,
      },
    },
    activationExperimentModeRaw: "off",
  });

  assert.equal(result.effectiveWebllmEnabled, false);
  assert.equal(result.activationExperiment.state, "globally_off");
  assert.equal(result.activationExperiment.mode, "off");
  assert.equal(result.activationExperiment.policyOutcome, "globally_off");
  assert.equal(result.activationExperiment.experimentReady, false);
  assert.equal(result.activationExperiment.noDispatchReason, "global_policy_off");
  assert.equal(result.activationExperiment.candidateEligibility, "ineligible");
  assert.deepEqual(result.activationExperiment.hardBlockers, ["auth_required", "ssot_disabled"]);
});


test("activation hook distinguishes observe-only from globally-off and eligible-no-dispatch", () => {
  const result = resolveLessonWebllmActivationHook({
    effectiveWebllmEnabled: true,
    preflight: {
      eligibility: "eligible",
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
    },
    activationExperimentModeRaw: "observe_only",
  });

  assert.equal(result.activationExperiment.state, "observe_only");
  assert.equal(result.activationExperiment.policyOutcome, "observe_only");
  assert.equal(result.activationExperiment.experimentReady, false);
  assert.equal(result.activationExperiment.noDispatchReason, "observe_only_mode");
});
