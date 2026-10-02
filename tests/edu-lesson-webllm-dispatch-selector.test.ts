import assert from "node:assert/strict";
import test from "node:test";

import type { LessonWebllmActivationHookResult } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import {
  readLessonWebllmDispatchExperimentMode,
  resolveLessonWebllmDispatchSelector,
} from "@/lib/edu/lesson/lessonWebllmDispatchSelector";

const baseActivationHook = (): LessonWebllmActivationHookResult => ({
  effectiveWebllmEnabled: true,
  activationExperiment: {
    state: "eligible_no_dispatch",
    mode: "eligible_noop",
    policyOutcome: "eligible_noop_observed",
    experimentReady: true,
    noDispatchReason: "eligible_but_no_dispatch_contract",
    candidateEligibility: "eligible",
    hardBlockers: [],
  },
});

test("dispatch selector preserves OpenAI mainline by default", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: baseActivationHook(),
    dispatchExperimentModeRaw: undefined,
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "dispatch_experiment_off");
  assert.equal(selection.experimentScope, "off");
});

test("dispatch selector kill-switch forces safe off even when experiment mode is enabled", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: baseActivationHook(),
    dispatchExperimentModeRaw: "contained_lesson_local",
    dispatchKillSwitchRaw: "1",
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "dispatch_kill_switch_on");
  assert.equal(selection.experimentScope, "off");
});

test("dispatch selector honors lesson allowlist and blocks out-of-scope lessons", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: baseActivationHook(),
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 7,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "not_in_rollout_scope");
  assert.equal(selection.experimentScope, "not_in_scope");
});

test("dispatch selector stays on mainline when activation is not ready", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: {
      ...baseActivationHook(),
      activationExperiment: {
        ...baseActivationHook().activationExperiment,
        experimentReady: false,
      },
    },
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 2,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "activation_not_ready");
  assert.equal(selection.experimentScope, "in_scope_but_blocked");
});

test("dispatch selector stays on mainline when preflight is ineligible", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: {
      ...baseActivationHook(),
      activationExperiment: {
        ...baseActivationHook().activationExperiment,
        candidateEligibility: "ineligible",
      },
    },
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 2,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "preflight_ineligible");
  assert.equal(selection.experimentScope, "in_scope_but_blocked");
});

test("dispatch selector stays on mainline when hard blockers exist", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: {
      ...baseActivationHook(),
      activationExperiment: {
        ...baseActivationHook().activationExperiment,
        hardBlockers: ["env_missing"],
      },
    },
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 2,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "hard_blockers_present");
  assert.equal(selection.experimentScope, "in_scope_but_blocked");
});

test("dispatch selector classifies effective webllm disabled state as opted_out in scope", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: {
      ...baseActivationHook(),
      effectiveWebllmEnabled: false,
    },
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 2,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "effective_webllm_disabled");
  assert.equal(selection.experimentScope, "opted_out");
});

test("dispatch selector keeps mainline when rollout allowlist is not explicitly configured", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: baseActivationHook(),
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 2,
  });

  assert.equal(selection.dispatchMode, "openai_mainline");
  assert.equal(selection.wouldDispatchToWebllm, false);
  assert.equal(selection.reason, "not_in_rollout_scope");
  assert.equal(selection.experimentScope, "not_in_scope");
});

test("dispatch selector allows contained dispatch only under strict opt-in + eligible conditions", () => {
  const selection = resolveLessonWebllmDispatchSelector({
    activationHook: baseActivationHook(),
    dispatchExperimentModeRaw: "contained_lesson_local",
    lessonId: 2,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.equal(selection.dispatchMode, "webllm_contained");
  assert.equal(selection.wouldDispatchToWebllm, true);
  assert.equal(selection.reason, "contained_dispatch_enabled");
  assert.equal(selection.experimentScope, "in_scope_eligible");
});

test("dispatch selector env reader normalizes unknown value to off", () => {
  const prev = process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_EXPERIMENT;
  try {
    process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_EXPERIMENT = "not-real";
    assert.equal(readLessonWebllmDispatchExperimentMode(), "off");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_EXPERIMENT;
    else process.env.NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_EXPERIMENT = prev;
  }
});
