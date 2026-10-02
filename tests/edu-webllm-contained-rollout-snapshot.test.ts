import assert from "node:assert/strict";
import test from "node:test";

import {
  isContainedRolloutReadyToAttempt,
  resolveWebllmContainedRolloutSnapshot,
} from "@/lib/edu/llm/webllmContainedRolloutSnapshot";

test("allowlisted + fully ready resolves ready_to_attempt", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    shouldAttemptLocalInit: true,
    shouldUseServerFallback: false,
  });

  assert.equal(snapshot.operatorState, "ready_to_attempt");
  assert.equal(isContainedRolloutReadyToAttempt(snapshot.operatorState), true);
});

test("non-allowlisted resolves out_of_rollout_scope", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "not_allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    shouldAttemptLocalInit: false,
    shouldUseServerFallback: true,
  });

  assert.equal(snapshot.operatorState, "out_of_rollout_scope");
});

test("kill switch resolves blocked_safe", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    killSwitchOn: true,
    shouldAttemptLocalInit: false,
    shouldUseServerFallback: true,
  });

  assert.equal(snapshot.operatorState, "blocked_safe");
});

test("degraded blocked resolves degraded_hold", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: true,
    shouldAttemptLocalInit: false,
    shouldUseServerFallback: true,
  });

  assert.equal(snapshot.operatorState, "degraded_hold");
});

test("canonical not ready resolves canonical_not_ready", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: false,
    healthReady: true,
    shouldAttemptLocalInit: false,
    shouldUseServerFallback: true,
  });

  assert.equal(snapshot.operatorState, "canonical_not_ready");
});

test("env missing resolves env_not_ready", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: false,
    canonicalReady: false,
    healthReady: false,
    shouldAttemptLocalInit: false,
    shouldUseServerFallback: true,
  });

  assert.equal(snapshot.operatorState, "env_not_ready");
});

test("health not ready resolves health_not_ready when env is present", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: false,
    shouldAttemptLocalInit: false,
    shouldUseServerFallback: true,
  });

  assert.equal(snapshot.operatorState, "health_not_ready");
});

test("snapshot safe summary does not leak token-like values", () => {
  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    dispatchExperiment: "contained_lesson_local",
    activationExperiment: "eligible_noop",
    invalidReasons: ["primary:wasm_candidates_missing"],
    shouldAttemptLocalInit: true,
    shouldUseServerFallback: false,
  });

  const serialized = JSON.stringify(snapshot);
  assert.equal(/token|secret|apikey|bearer/i.test(serialized), false);
});
