import assert from "node:assert/strict";
import test from "node:test";

import { buildLearningGoalSummary } from "@/lib/coding-studio/learningGoalSummary";

test("learning goal summary returns Korean-first continuity lines", () => {
  const summary = buildLearningGoalSummary({
    lessonId: "sensor-avoid",
    completedCount: 2,
    feedbackCount: 1,
  });

  assert.match(summary.title, /현재 학습 초점/);
  assert.match(summary.whyThisMatters, /조건|분기|신호/);
  assert.match(summary.momentumLine, /피드백 1개/);
  assert.match(summary.progressLine, /2\/4/);
  assert.match(summary.refineFocus, /감지 뒤에 실제 회피 동작/);
});

test("learning goal summary preserves canonical repeat-route contract", () => {
  const summary = buildLearningGoalSummary({
    lessonId: "repeat-route",
    completedCount: 3,
    feedbackCount: 2,
  });

  assert.match(summary.currentPractice, /반복 구조/);
  assert.match(summary.refineFocus, /같은 패턴을 반복 블록으로 묶었나요\?/);
});

test("learning goal summary is deterministic and handles malformed counters safely", () => {
  const first = buildLearningGoalSummary({ lessonId: "sensor-branch", completedCount: -9, feedbackCount: Number.NaN });
  const second = buildLearningGoalSummary({ lessonId: "sensor-branch", completedCount: -9, feedbackCount: Number.NaN });

  assert.deepEqual(first, second);
  assert.match(first.progressLine, /0\/4/);
  assert.match(first.momentumLine, /피드백 0개/);
});
