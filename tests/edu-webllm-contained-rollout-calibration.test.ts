import assert from "node:assert/strict";
import test from "node:test";

import { buildWebllmContainedAttemptEvidence } from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import {
  resolveWebllmContainedRolloutDecision,
  summarizeRecentContainedRolloutEvidence,
  WEBLLM_CONTAINED_ROLLOUT_CALIBRATION,
} from "@/lib/edu/llm/webllmContainedRolloutCalibration";

const evidence = (outcome: "success" | "timeout" | "engine_error" | "no_response" | "fallback_only" | "blocked") =>
  buildWebllmContainedAttemptEvidence({
    lessonIdSafe: "1",
    operatorStateAtAttempt: "ready_to_attempt",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "webllm_contained",
    attemptDecision: "attempted_local",
    outcome,
    safeReason: outcome,
  });

test("clean recent success window resolves GO", () => {
  const result = resolveWebllmContainedRolloutDecision({
    operatorState: "ready_to_attempt",
    evidenceRows: [evidence("success"), evidence("success")],
  });

  assert.equal(result.decision, "go");
  assert.equal(result.confidence, "high");
  assert.equal(result.decisionReason, "clean_recent_success_window");
});

test("canonical/health/env-not-ready operator states resolve HOLD", () => {
  const canonical = resolveWebllmContainedRolloutDecision({ operatorState: "canonical_not_ready", evidenceRows: [] });
  const health = resolveWebllmContainedRolloutDecision({ operatorState: "health_not_ready", evidenceRows: [] });
  const env = resolveWebllmContainedRolloutDecision({ operatorState: "env_not_ready", evidenceRows: [] });

  assert.equal(canonical.decision, "hold");
  assert.equal(health.decision, "hold");
  assert.equal(env.decision, "hold");
});

test("repeated no_response resolves non-go verdict", () => {
  const result = resolveWebllmContainedRolloutDecision({
    operatorState: "ready_to_attempt",
    evidenceRows: [evidence("no_response"), evidence("no_response")],
  });

  assert.notEqual(result.decision, "go");
  assert.equal(result.decision, "stop");
});

test("repeated timeout resolves non-go verdict", () => {
  const result = resolveWebllmContainedRolloutDecision({
    operatorState: "ready_to_attempt",
    evidenceRows: [evidence("timeout"), evidence("timeout")],
  });

  assert.equal(result.decision, "hold");
});

test("engine_error escalates faster than timeout/no_response", () => {
  const engineError = resolveWebllmContainedRolloutDecision({
    operatorState: "ready_to_attempt",
    evidenceRows: [evidence("engine_error")],
  });
  const noResponse = resolveWebllmContainedRolloutDecision({
    operatorState: "ready_to_attempt",
    evidenceRows: [evidence("no_response")],
  });

  assert.equal(engineError.decision, "stop");
  assert.equal(noResponse.decision, "hold");
  assert.equal(
    WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.engineErrorStopThreshold <
      WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.repeatedNoResponseStopThreshold,
    true,
  );
});

test("blocked_safe / blocked outcomes stay conservative", () => {
  const blockedState = resolveWebllmContainedRolloutDecision({
    operatorState: "blocked_safe",
    evidenceRows: [evidence("success"), evidence("success")],
  });
  const blockedOutcome = resolveWebllmContainedRolloutDecision({
    operatorState: "ready_to_attempt",
    evidenceRows: [evidence("blocked")],
  });

  assert.equal(blockedState.decision, "stop");
  assert.equal(blockedOutcome.decision, "stop");
});

test("summary counts remain safe and secret-free", () => {
  const summary = summarizeRecentContainedRolloutEvidence([
    evidence("success"),
    evidence("timeout"),
    evidence("no_response"),
  ]);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.counts.successes, 1);
  assert.equal(summary.counts.timeouts, 1);
  assert.equal(summary.counts.noResponses, 1);
  assert.equal(/token|secret|apikey|bearer|prompt/i.test(serialized), false);
});
