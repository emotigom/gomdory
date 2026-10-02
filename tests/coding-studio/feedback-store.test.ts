import assert from "node:assert/strict";
import test from "node:test";

import { getLatestFeedbackNotesForLesson, listFeedbackNotesForSubmission, upsertCodingStudioFeedbackNote } from "@/lib/coding-studio/feedbackStore";
import type { CodingStudioFeedbackNote } from "@/lib/coding-studio/feedbackSchema";

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

function makeNote(feedbackId: string, submissionId: string, createdAt: string): CodingStudioFeedbackNote {
  return {
    feedbackSchemaVersion: 1,
    feedbackId,
    submissionId,
    lessonId: "goal-move",
    createdAt,
    source: { sourceType: "teacher-local", authorId: "teacher-local", authorLabel: "교사" },
    noteType: "retry-focus",
    title: "다시 다듬기",
    body: "목표 거리를 확인해 보세요.",
  };
}

test("feedback store persists notes per submission and latest lesson context", () => {
  installStorageMock();
  upsertCodingStudioFeedbackNote(makeNote("f1", "s1", new Date(1).toISOString()));
  upsertCodingStudioFeedbackNote(makeNote("f2", "s2", new Date(2).toISOString()));

  assert.equal(listFeedbackNotesForSubmission("s1").length, 1);
  assert.equal(getLatestFeedbackNotesForLesson("goal-move")[0]?.submissionId, "s2");
});
