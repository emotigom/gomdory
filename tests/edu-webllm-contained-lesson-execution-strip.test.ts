import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { buildWebllmContainedAttemptEvidence } from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import { resolveWebllmContainedRolloutSnapshot } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";
import { buildWebllmContainedLessonExecutionStripModel } from "@/lib/edu/llm/webllmContainedLessonExecutionStrip";

const makeSnapshot = (input?: Partial<Parameters<typeof resolveWebllmContainedRolloutSnapshot>[0]>) =>
  resolveWebllmContainedRolloutSnapshot({
    lessonScope: "allowlisted",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    shouldAttemptLocalInit: true,
    shouldUseServerFallback: false,
    ...input,
  });

const row = (input: {
  lessonIdSafe?: string;
  outcome: "success" | "timeout" | "engine_error" | "no_response" | "fallback_only";
}) =>
  buildWebllmContainedAttemptEvidence({
    lessonIdSafe: input.lessonIdSafe ?? "1",
    operatorStateAtAttempt: "ready_to_attempt",
    bootstrapReady: true,
    canonicalReady: true,
    healthReady: true,
    degradedBlocked: false,
    killSwitchOn: false,
    dispatchMode: "webllm_contained",
    attemptDecision: "attempted_local",
    outcome: input.outcome,
    safeReason: input.outcome,
  });

test("ready_to_attempt + stable evidence resolves GO model", () => {
  const model = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot(),
    evidenceRows: [row({ outcome: "success" }), row({ outcome: "success" })],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  assert.equal(model.verdict, "GO");
  assert.equal(model.tone, "ready");
});

test("out_of_rollout_scope resolves HOLD/neutral model", () => {
  const model = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot({ lessonScope: "not_allowlisted", shouldAttemptLocalInit: false, shouldUseServerFallback: true }),
    evidenceRows: [],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  assert.equal(model.verdict, "HOLD");
  assert.equal(model.tone, "neutral");
});

test("blocked_safe resolves STOP model", () => {
  const model = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot({ killSwitchOn: true, shouldAttemptLocalInit: false, shouldUseServerFallback: true }),
    evidenceRows: [],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  assert.equal(model.verdict, "STOP");
  assert.equal(model.tone, "blocked");
});

test("canonical_not_ready/degraded_hold resolve HOLD model", () => {
  const canonicalHold = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot({ canonicalReady: false, shouldAttemptLocalInit: false, shouldUseServerFallback: true }),
    evidenceRows: [],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  const degradedHold = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot({ degradedBlocked: true, shouldAttemptLocalInit: false, shouldUseServerFallback: true }),
    evidenceRows: [],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  assert.equal(canonicalHold.verdict, "HOLD");
  assert.equal(degradedHold.verdict, "HOLD");
});

test("recent no_response/fallback_only is reflected", () => {
  const model = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot(),
    evidenceRows: [row({ outcome: "success" }), row({ outcome: "no_response" }), row({ outcome: "fallback_only" })],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  assert.equal(model.recentOutcomeLabel.includes("fallback_only"), true);
});

test("strip model output is secret free", () => {
  const model = buildWebllmContainedLessonExecutionStripModel({
    snapshot: makeSnapshot(),
    evidenceRows: [row({ outcome: "success" })],
    lessonId: 1,
    teacherOrDebugVisible: true,
  });

  assert.equal(/token|secret|apikey|bearer|prompt/i.test(JSON.stringify(model)), false);
});

test("lesson UI uses shared strip helper/handoff vocabulary", async () => {
  const source = await readFile("app/edu/_components/ChatPanel.tsx", "utf8");
  assert.equal(source.includes("buildWebllmContainedLessonExecutionStripModel"), true);

  const stripSource = await readFile("lib/edu/llm/webllmContainedLessonExecutionStrip.ts", "utf8");
  assert.equal(stripSource.includes("buildWebllmContainedRolloutHandoffPack"), true);
});
