import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFlowV2, type FlowStep } from "@/app/dashboard/flows";
import { getRemainingSeconds } from "@/lib/flow/stepTimer";

test("normalizeFlowV2 trims text, clamps seconds, normalizes actions", () => {
  const longPrompt = "x".repeat(600);
  const step: FlowStep = {
    id: "step-1",
    label: "라벨",
    presetId: "preset-1",
    target: "class",
    title: "  테스트 타이틀  ",
    prompt: `  안내문 ${longPrompt}`,
    seconds: 5000,
    actions: {
      qa: "open",
      pulse: "reset",
      poll: { mode: "open", pollId: "  poll-id  " },
    },
  };

  const normalized = normalizeFlowV2(step);
  assert.equal(normalized.title, "테스트 타이틀");
  assert.ok(normalized.prompt?.startsWith("안내문"));
  assert.equal(normalized.prompt?.length, 500);
  assert.equal(normalized.seconds, 3600);
  assert.deepEqual(normalized.actions, {
    qa: "open",
    pulse: "reset",
    poll: { mode: "open", pollId: "poll-id" },
  });
});

test("normalizeFlowV2 drops invalid actions", () => {
  const step: FlowStep = {
    id: "step-2",
    label: "라벨",
    presetId: "preset-2",
    target: "class",
    actions: {
      qa: "invalid" as "open",
      pulse: "invalid" as "reset",
      poll: { mode: "invalid" as "open", pollId: "x" },
    },
  };

  const normalized = normalizeFlowV2(step);
  assert.equal(normalized.actions, undefined);
});

test("getRemainingSeconds returns remaining time with pause handling", () => {
  const remaining = getRemainingSeconds(
    {
      startedAt: 0,
      seconds: 10,
      paused: true,
      pausedAt: 4000,
    },
    9000,
  );
  assert.equal(remaining, 6);

  const finished = getRemainingSeconds(
    {
      startedAt: 0,
      seconds: 3,
    },
    10_000,
  );
  assert.equal(finished, 0);
});
