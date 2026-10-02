import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_LESSON_PATH, canUnlockLesson, resolveUnlockedLessonIds } from "@/lib/coding-studio/lessons";

function assertRequiredTextField(lesson: Record<string, unknown>, key: string): void {
  const value = lesson[key];
  assert.equal(typeof value, "string", `expected ${key} to be a string`);
  assert.equal((value as string).length > 0, true, `expected ${key} to be non-empty`);
}

test("starter lesson path includes guided Korean metadata for classroom-first flow", () => {
  assert.deepEqual(
    STUDIO_LESSON_PATH.map((lesson) => lesson.id),
    ["goal-move", "turn-pivot", "repeat-route", "sensor-branch", "strategy-tune", "next-preview"],
  );

  for (const lesson of STUDIO_LESSON_PATH) {
    // Canonical coding-studio contract: repeat-route is the control lesson id.
    for (const key of [
      "title",
      "subtitle",
      "goalLine",
      "whyThisMatters",
      "recommendedFirstStep",
      "successCondition",
      "completionReflection",
      "nextLessonPrompt",
      "assessmentFocus",
      "teacherPurpose",
      "resetHint",
    ]) {
      assertRequiredTextField(lesson as unknown as Record<string, unknown>, key);
    }

    // Optional metadata can be absent; validate only when present.
    const previewLine = (lesson as unknown as { previewLine?: unknown }).previewLine;
    if (previewLine !== undefined) {
      assert.equal(typeof previewLine, "string");
      assert.equal(previewLine.length > 0, true);
    }

    assert.match(lesson.goalLine, /[가-힣]/);
  }
});

test("lesson unlock rules follow deterministic prerequisite order", () => {
  const unlockedAtStart = resolveUnlockedLessonIds([]);
  assert.deepEqual(unlockedAtStart, ["goal-move"]);

  assert.equal(canUnlockLesson("turn-pivot", ["goal-move"]), true);
  assert.equal(canUnlockLesson("repeat-route", ["goal-move"]), false);
  assert.deepEqual(resolveUnlockedLessonIds(["goal-move", "turn-pivot", "repeat-route", "sensor-branch", "strategy-tune"]), [
    "goal-move",
    "turn-pivot",
    "repeat-route",
    "sensor-branch",
    "strategy-tune",
    "next-preview",
  ]);
});
