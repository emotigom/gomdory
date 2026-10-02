import assert from "node:assert/strict";
import test from "node:test";

import { assessLessonCheckpoint } from "@/lib/coding-studio/assessment";
import { createInitialStudioRuntimeState } from "@/lib/coding-studio/interpreter";
import { STUDIO_LESSON_SCENES } from "@/lib/coding-studio/lessons";

test("assessment returns success when goal is reached", () => {
  const scene = STUDIO_LESSON_SCENES["goal-move"];
  const state = createInitialStudioRuntimeState(scene);
  state.x = scene.goal.x;
  state.z = scene.goal.z;
  state.reachedGoal = true;
  const result = assessLessonCheckpoint({
    lessonId: "goal-move",
    runtimeState: state,
    blocks: [{ id: "start-1", type: "start" }],
  });
  assert.equal(result.completed, true);
  assert.equal(result.tone, "success");
});

test("assessment returns near-success when blocked or near goal", () => {
  const scene = STUDIO_LESSON_SCENES["turn-pivot"];
  const state = createInitialStudioRuntimeState(scene);
  state.blocked = true;
  const result = assessLessonCheckpoint({
    lessonId: "turn-pivot",
    runtimeState: state,
    blocks: [{ id: "start-1", type: "start" }],
  });
  assert.equal(result.completed, false);
  assert.equal(result.tone, "near-success");
});

test("assessment guides retry for missing sensor branch", () => {
  const scene = STUDIO_LESSON_SCENES["sensor-branch"];
  const state = createInitialStudioRuntimeState(scene);
  const result = assessLessonCheckpoint({
    lessonId: "sensor-branch",
    runtimeState: state,
    blocks: [{ id: "start-1", type: "start" }, { id: "move-1", type: "move", params: { distance: 1 } }],
  });
  assert.equal(result.tone, "retry");
  assert.match(result.retryHint, /감지 조건/);
});
