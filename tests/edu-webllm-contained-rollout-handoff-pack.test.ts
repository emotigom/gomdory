import assert from "node:assert/strict";
import test from "node:test";

import { buildWebllmContainedAttemptEvidence } from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import { buildWebllmContainedRolloutHandoffPack } from "@/lib/edu/llm/webllmContainedRolloutHandoffPack";
import { resolveWebllmContainedRolloutSnapshot } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";

const readySnapshot = () =>
  resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    shouldAttemptLocalInit: true,
    shouldUseServerFallback: false,
    dispatchExperiment: "contained_lesson_local",
    activationExperiment: "eligible_noop",
  });

const evidence = (outcome: "success" | "timeout" | "engine_error" | "no_response") =>
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

test("ready_to_attempt + clean success window resolves GO", () => {
  const pack = buildWebllmContainedRolloutHandoffPack({
    snapshot: readySnapshot(),
    evidenceRows: [evidence("success"), evidence("success")],
  });

  assert.equal(pack.decision, "go");
});

test("canonical or health not ready resolves HOLD", () => {
  const canonicalHold = buildWebllmContainedRolloutHandoffPack({
    snapshot: resolveWebllmContainedRolloutSnapshot({
      lessonScope: "allowlisted",
      bootstrapReady: true,
      canonicalReady: false,
      healthReady: true,
      shouldAttemptLocalInit: false,
      shouldUseServerFallback: true,
    }),
    evidenceRows: [],
  });

  const healthHold = buildWebllmContainedRolloutHandoffPack({
    snapshot: resolveWebllmContainedRolloutSnapshot({
      lessonScope: "allowlisted",
      bootstrapReady: true,
      canonicalReady: true,
      healthReady: false,
      shouldAttemptLocalInit: false,
      shouldUseServerFallback: true,
    }),
    evidenceRows: [],
  });

  assert.equal(canonicalHold.decision, "hold");
  assert.equal(healthHold.decision, "hold");
});

test("blocked_safe resolves STOP", () => {
  const pack = buildWebllmContainedRolloutHandoffPack({
    snapshot: resolveWebllmContainedRolloutSnapshot({
      lessonScope: "allowlisted",
      bootstrapReady: true,
      canonicalReady: true,
      healthReady: true,
      killSwitchOn: true,
      shouldAttemptLocalInit: false,
      shouldUseServerFallback: true,
    }),
    evidenceRows: [],
  });

  assert.equal(pack.decision, "stop");
});

test("repeated engine/no_response resolves non-go verdict", () => {
  const pack = buildWebllmContainedRolloutHandoffPack({
    snapshot: readySnapshot(),
    evidenceRows: [evidence("engine_error"), evidence("no_response")],
  });

  assert.equal(pack.decision, "stop");
});

test("safeCopyText contains no token-like/prompt-like terms", () => {
  const pack = buildWebllmContainedRolloutHandoffPack({
    snapshot: readySnapshot(),
    evidenceRows: [evidence("success")],
  });

  assert.equal(/token|secret|apikey|bearer|prompt/i.test(pack.safeCopyText), false);
});


test("handoff pack delegates verdict mapping to calibration helper", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("lib/edu/llm/webllmContainedRolloutHandoffPack.ts", "utf8");
  assert.equal(source.includes("resolveWebllmContainedRolloutDecision"), true);
  assert.equal(source.includes("summarizeRecentContainedRolloutEvidence"), true);
});
