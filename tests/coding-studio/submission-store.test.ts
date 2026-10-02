import assert from "node:assert/strict";
import test from "node:test";

import { getLatestSubmissionForLesson, listSubmissionsByLesson, saveCodingStudioSubmission } from "@/lib/coding-studio/submissionStore";
import type { CodingStudioSubmissionSnapshot } from "@/lib/coding-studio/submissionSchema";

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

test.afterEach(() => {
  delete (globalThis as { window?: Window & typeof globalThis }).window;
});

function makeSnapshot(
  submissionId: string,
  submittedAt = new Date().toISOString(),
): CodingStudioSubmissionSnapshot {
  return {
    submissionSchemaVersion: 1,
    submissionId,
    assignmentId: null,
    lessonId: "goal-move",
    projectSchemaVersion: 1,
    submittedAt,
    entrySource: "free-practice",
    projectSnapshot: { schemaVersion: 1, projectId: "p", title: "t", lessonId: "goal-move", blocks: [], metadata: { updatedAt: new Date(0).toISOString(), source: "student" } },
    assessment: { tone: "retry", summary: "요약", keyCondition: "조건" },
    evidence: {
      outcome: "attempted",
      runtime: { reachedGoal: false, blocked: false, stepCount: 0, finalPosition: { x: 0, z: 0, heading: 0 } },
      structure: { blockCount: 0, irInstructionCount: 0, repeatCount: 0, turnCount: 0, sensorCount: 0 },
      lessonSignal: { focus: "조건" },
      scene: { goalDistance: 0 },
    },
    replay: { reviewModeSupported: true, runtimeState: { x: 0, z: 0, heading: 0, stepCount: 0, reachedGoal: false, blocked: false }, sceneId: "goal-move" },
    revision: { previousSubmissionId: null, reworkSourceSubmissionId: null },
  };
}

test("submission store persists and lists lesson submissions", () => {
  installStorageMock();
  saveCodingStudioSubmission(makeSnapshot("s1", "2026-01-01T00:00:00.000Z"));
  saveCodingStudioSubmission(makeSnapshot("s2", "2026-01-01T00:00:01.000Z"));

  const list = listSubmissionsByLesson("goal-move");
  assert.equal(list.length, 2);
  assert.equal(getLatestSubmissionForLesson("goal-move")?.submissionId, "s2");
});

test("submission store keeps the last saved submission first when timestamps tie", () => {
  installStorageMock();
  const submittedAt = "2026-01-01T00:00:00.000Z";
  saveCodingStudioSubmission(makeSnapshot("s1", submittedAt));
  saveCodingStudioSubmission(makeSnapshot("s2", submittedAt));

  const list = listSubmissionsByLesson("goal-move");
  assert.equal(list.length, 2);
  assert.equal(list[0]?.submissionId, "s2");
  assert.equal(getLatestSubmissionForLesson("goal-move")?.submissionId, "s2");
});

test("submission store is SSR-safe and corrupt-data tolerant", () => {
  delete (globalThis as { window?: Window & typeof globalThis }).window;
  assert.deepEqual(listSubmissionsByLesson("goal-move"), []);

  installStorageMock();
  window.localStorage.setItem("gomdoryedu.coding-studio.submissions.v1", "{bad-json");
  assert.deepEqual(listSubmissionsByLesson("goal-move"), []);
});

test("submission store returns fresh snapshots to prevent mutation leaks", () => {
  installStorageMock();
  saveCodingStudioSubmission(makeSnapshot("fresh-1"));
  const firstRead = getLatestSubmissionForLesson("goal-move");
  assert.ok(firstRead);
  firstRead.assessment.summary = "mutated";
  const secondRead = getLatestSubmissionForLesson("goal-move");
  assert.ok(secondRead);
  assert.equal(secondRead.assessment.summary, "요약");
});
