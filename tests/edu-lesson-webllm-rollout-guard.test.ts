import assert from "node:assert/strict";
import test from "node:test";

import type { LessonWebllmActivationHookResult } from "@/lib/edu/lesson/lessonWebllmActivationHook";
import { resolveLessonWebllmExperimentRolloutGuard } from "@/lib/edu/lesson/lessonWebllmExperimentRolloutGuard";

const activationHook = (): LessonWebllmActivationHookResult => ({
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

test("rollout guard returns off when dispatch experiment is off", () => {
  const guard = resolveLessonWebllmExperimentRolloutGuard({
    dispatchExperimentMode: "off",
    activationHook: activationHook(),
  });

  assert.deepEqual(guard, {
    scope: "off",
    reason: "dispatch_experiment_off",
    inRolloutScope: false,
  });
});

test("rollout guard returns off with explicit kill switch when experiment mode is enabled", () => {
  const guard = resolveLessonWebllmExperimentRolloutGuard({
    dispatchExperimentMode: "contained_lesson_local",
    activationHook: activationHook(),
    dispatchKillSwitchRaw: "1",
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.deepEqual(guard, {
    scope: "off",
    reason: "dispatch_kill_switch_on",
    inRolloutScope: false,
  });
});

test("rollout guard requires explicit lesson allowlist before enabling contained scope", () => {
  const guard = resolveLessonWebllmExperimentRolloutGuard({
    dispatchExperimentMode: "contained_lesson_local",
    activationHook: activationHook(),
    lessonId: 2,
  });

  assert.deepEqual(guard, {
    scope: "not_in_scope",
    reason: "default_mainline",
    inRolloutScope: false,
  });
});

test("rollout guard filters lessons not present in allowlist", () => {
  const guard = resolveLessonWebllmExperimentRolloutGuard({
    dispatchExperimentMode: "contained_lesson_local",
    activationHook: activationHook(),
    lessonId: 5,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.deepEqual(guard, {
    scope: "not_in_scope",
    reason: "default_mainline",
    inRolloutScope: false,
  });
});

test("rollout guard allows in-scope lesson when allowlist includes lesson id", () => {
  const guard = resolveLessonWebllmExperimentRolloutGuard({
    dispatchExperimentMode: "contained_lesson_local",
    activationHook: activationHook(),
    lessonId: 2,
    rolloutLessonAllowlistRaw: "1,2,3",
  });

  assert.deepEqual(guard, {
    scope: "in_scope_eligible",
    reason: "contained_dispatch_enabled",
    inRolloutScope: true,
  });
});
