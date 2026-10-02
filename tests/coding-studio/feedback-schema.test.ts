import assert from "node:assert/strict";
import test from "node:test";

import { parseCodingStudioFeedbackNote } from "@/lib/coding-studio/feedbackSchema";

const CURRENT_NOTE = {
  feedbackSchemaVersion: 1,
  feedbackId: "f1",
  submissionId: "s1",
  lessonId: "repeat-route",
  createdAt: new Date(0).toISOString(),
  source: { sourceType: "teacher-local", authorId: "teacher-local", authorLabel: "교사" },
  noteType: "retry-focus",
  title: "다시 다듬기",
  body: "반복 블록 수를 먼저 확인해 보세요.",
  targetArea: "repeat",
  criterionId: "repeat-route-structure",
  recommendedAction: "실행 전 반복 count 확인",
} as const;

test("feedback schema parser accepts current note", () => {
  const parsed = parseCodingStudioFeedbackNote(CURRENT_NOTE);

  assert.ok(parsed);
  assert.equal(parsed?.feedbackSchemaVersion, 1);
  assert.equal(parsed?.lessonId, "repeat-route");
  assert.equal(parsed?.criterionId, "repeat-route-structure");
});

test("feedback schema parser is deterministic across repeated calls", () => {
  const first = parseCodingStudioFeedbackNote(CURRENT_NOTE);
  const second = parseCodingStudioFeedbackNote(CURRENT_NOTE);
  assert.deepEqual(first, second);
});

test("feedback schema parser allows missing optional fields", () => {
  const parsed = parseCodingStudioFeedbackNote({
    feedbackSchemaVersion: 1,
    feedbackId: "f-optional",
    submissionId: "s-optional",
    lessonId: "goal-move",
    createdAt: new Date(0).toISOString(),
    source: { sourceType: "teacher-local", authorId: "teacher-local", authorLabel: "교사" },
    noteType: "next-step",
    title: "다음 단계",
    body: "좌표 비교 근거를 먼저 정리해 보세요.",
  });

  assert.ok(parsed);
  assert.equal(parsed?.criterionId, undefined);
  assert.equal(parsed?.recommendedAction, undefined);
});

test("feedback schema parser fails safely for invalid required fields", () => {
  const parsed = parseCodingStudioFeedbackNote({
    feedbackSchemaVersion: 1,
    feedbackId: "f-invalid",
    submissionId: "s-invalid",
    lessonId: "unknown-lesson",
    createdAt: new Date(0).toISOString(),
    source: { sourceType: "teacher-local", authorId: "teacher-local", authorLabel: "교사" },
    noteType: "retry-focus",
    title: "invalid",
    body: "invalid",
  });

  assert.equal(parsed, null);
});

test("feedback schema parser drops legacy repeat-structure and keeps safe core fields", () => {
  const parsed = parseCodingStudioFeedbackNote({
    ...CURRENT_NOTE,
    feedbackId: "f-legacy-criterion",
    criterionId: "repeat-structure",
  });

  assert.ok(parsed);
  assert.equal(parsed?.criterionId, undefined);
  assert.equal(parsed?.lessonId, "repeat-route");
});

test("feedback schema parser migrates legacy feedback", () => {
  const parsed = parseCodingStudioFeedbackNote({
    submissionId: "s-legacy",
    lessonId: "goal-move",
    title: "이전 피드백",
    body: "기록 이전",
  });

  assert.ok(parsed);
  assert.equal(parsed?.feedbackSchemaVersion, 1);
  assert.equal(parsed?.source.authorLabel, "교사");
});
