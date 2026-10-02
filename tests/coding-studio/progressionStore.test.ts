import assert from "node:assert/strict";
import test from "node:test";

import { createInitialProgressionState, markLessonCompleted, parseProgressionState, updateCurrentLesson } from "@/lib/coding-studio/progressionStore";

test("progression initializes with only first lesson unlocked", () => {
  const state = createInitialProgressionState();
  assert.equal(state.currentLessonId, "goal-move");
  assert.deepEqual(state.completedLessonIds, []);
  assert.deepEqual(state.unlockedLessonIds, ["goal-move"]);
});

test("completion unlocks next lesson in deterministic order", () => {
  const initial = createInitialProgressionState();
  const afterFirst = markLessonCompleted(initial, "goal-move");
  assert.deepEqual(afterFirst.unlockedLessonIds, ["goal-move", "turn-pivot"]);
  assert.equal(afterFirst.currentLessonId, "turn-pivot");
});

test("parser migrates to safe unlocked current lesson", () => {
  const parsed = parseProgressionState({
    schemaVersion: 1,
    currentLessonId: "sensor-branch",
    completedLessonIds: ["goal-move"],
    unlockedLessonIds: ["goal-move", "turn-pivot", "sensor-branch"],
    updatedAt: new Date(0).toISOString(),
  });

  assert.equal(parsed?.currentLessonId, "goal-move");
});

test("manual current lesson update respects unlock bounds", () => {
  const initial = createInitialProgressionState();
  const updated = updateCurrentLesson(initial, "sensor-branch");
  assert.equal(updated.currentLessonId, "goal-move");
});
