import assert from "node:assert/strict";
import test from "node:test";

import { CODING_STUDIO_ASSIGNMENT_FIXTURES } from "@/lib/coding-studio/assignmentFixtures";
import {
  activateAssignment,
  advanceAssignmentOnLessonCompletion,
  createInitialAssignmentResumeState,
  parseAssignmentResumeState,
  resolveAssignedCurrentLesson,
  upsertCodingStudioAssignment,
} from "@/lib/coding-studio/assignmentStore";

function installStorageMock() {
  const memory = new Map<string, string>();
  (globalThis as { window?: Window & typeof globalThis }).window = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
      key: (index: number) => Array.from(memory.keys())[index] ?? null,
      get length() {
        return memory.size;
      },
    },
  } as unknown as Window & typeof globalThis;
}

test("assignment resume parser rejects invalid schema and keeps safe defaults", () => {
  const parsed = parseAssignmentResumeState({ schemaVersion: 99, currentLessonId: "goal-move" });
  assert.equal(parsed, null);

  const initial = createInitialAssignmentResumeState();
  assert.equal(initial.activeAssignmentId, null);
  assert.equal(initial.currentLessonId, null);
});

test("assignment store activates fixture and advances continuity by completion", () => {
  installStorageMock();
  const fixture = CODING_STUDIO_ASSIGNMENT_FIXTURES["intro-core-3"];
  upsertCodingStudioAssignment(fixture);

  const resume = activateAssignment({ assignmentId: fixture.assignmentId });
  assert.equal(resume.currentLessonId, "goal-move");

  const resolved = resolveAssignedCurrentLesson({ assignment: fixture, resume });
  assert.equal(resolved, "goal-move");

  const advanced = advanceAssignmentOnLessonCompletion({
    assignment: fixture,
    resume,
    completedLessonId: "goal-move",
  });
  assert.deepEqual(advanced.completedLessonIds, ["goal-move"]);
  assert.equal(advanced.currentLessonId, "turn-pivot");
});
