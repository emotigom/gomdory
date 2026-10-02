import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetWebllmContainedRolloutEvidenceForTests,
  appendWebllmContainedRolloutEvidence,
  buildWebllmContainedAttemptEvidence,
  getWebllmContainedRolloutEvidence,
} from "@/lib/edu/llm/webllmContainedRolloutEvidence";

test.beforeEach(() => {
  __resetWebllmContainedRolloutEvidenceForTests();
});

test("success attempt produces a safe evidence record", () => {
  const record = buildWebllmContainedAttemptEvidence({
    lessonIdSafe: 1,
    operatorStateAtAttempt: "ready_to_attempt",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "webllm_contained",
    attemptDecision: "attempted_local",
    outcome: "success",
    safeReason: "contained_dispatch_enabled",
  });

  assert.equal(record.lessonIdSafe, "1");
  assert.equal(record.outcome, "success");
  assert.equal(record.safeReason, "contained_dispatch_enabled");
});

test("canonical-not-ready produces skipped_not_ready record", () => {
  const record = buildWebllmContainedAttemptEvidence({
    lessonIdSafe: "1",
    operatorStateAtAttempt: "canonical_not_ready",
    bootstrapReady: true,
    canonicalReady: false,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "openai_mainline",
    attemptDecision: "skipped_not_ready",
    outcome: "not_ready",
    safeReason: "not_ready",
  });

  assert.equal(record.attemptDecision, "skipped_not_ready");
  assert.equal(record.outcome, "not_ready");
});

test("kill switch produces blocked-safe / skipped record", () => {
  const record = buildWebllmContainedAttemptEvidence({
    lessonIdSafe: "1",
    operatorStateAtAttempt: "blocked_safe",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: true,
    dispatchMode: "openai_mainline",
    attemptDecision: "skipped_kill_switch",
    outcome: "blocked",
    safeReason: "dispatch_kill_switch_on",
  });

  assert.equal(record.attemptDecision, "skipped_kill_switch");
  assert.equal(record.outcome, "blocked");
  assert.equal(record.killSwitchOn, true);
});

test("no_response is recorded distinctly", () => {
  const record = buildWebllmContainedAttemptEvidence({
    lessonIdSafe: "1",
    operatorStateAtAttempt: "ready_to_attempt",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "webllm_contained",
    attemptDecision: "attempted_local",
    outcome: "no_response",
    safeReason: "no_response",
  });

  assert.equal(record.outcome, "no_response");
});

test("ring buffer trims older entries deterministically", () => {
  for (let index = 0; index < 5; index += 1) {
    appendWebllmContainedRolloutEvidence(
      buildWebllmContainedAttemptEvidence({
        attemptedAt: new Date(2026, 0, index + 1).toISOString(),
        lessonIdSafe: String(index + 1),
        operatorStateAtAttempt: "ready_to_attempt",
        bootstrapReady: true,
        canonicalReady: true,
        healthReady: true,
        degradedBlocked: false,
        killSwitchOn: false,
        dispatchMode: "webllm_contained",
        attemptDecision: "attempted_local",
        outcome: "success",
        safeReason: "contained_dispatch_enabled",
      }),
      3,
    );
  }

  const rows = getWebllmContainedRolloutEvidence(3);
  assert.deepEqual(rows.map((row) => row.lessonIdSafe), ["3", "4", "5"]);
});

test("evidence records contain no token-like or prompt-like strings", () => {
  const record = buildWebllmContainedAttemptEvidence({
    lessonIdSafe: "lesson-1",
    operatorStateAtAttempt: "fallback_only",
    bootstrapReady: false,
    canonicalReady: false,
    healthReady: false,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "openai_mainline",
    attemptDecision: "fallback_only",
    outcome: "fallback_only",
    safeReason: "fallback_only",
    safeSummary: "fallback only summary",
  });
  const serialized = JSON.stringify(record);
  assert.equal(/token|secret|apikey|bearer|prompt/i.test(serialized), false);
});
