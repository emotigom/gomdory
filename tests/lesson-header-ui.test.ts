import assert from "node:assert/strict";
import test from "node:test";

import {
  getLessonHeaderStatus,
  getLessonStepLabel,
  getLessonWorkspaceContext,
} from "@/app/edu/lesson/lessonEntryUi";

test("getLessonWorkspaceContext returns lesson-specific concise context", () => {
  assert.match(getLessonWorkspaceContext(1), /소개 페이지/);
  assert.match(getLessonWorkspaceContext(2), /관심 주제/);
  assert.match(getLessonWorkspaceContext(3), /퀴즈|미니게임/);
  assert.match(getLessonWorkspaceContext(4), /작품/);
  assert.match(getLessonWorkspaceContext(0), /빈 페이지/);
  assert.match(getLessonWorkspaceContext(999), /작업 공간/);
});

test("getLessonHeaderStatus keeps status chips low density", () => {
  assert.deepEqual(getLessonHeaderStatus({ entryState: "free_mode_entry", isRecommended: false }), {
    chipLabel: "자유 시작",
    metadata: null,
  });
  assert.deepEqual(getLessonHeaderStatus({ entryState: "resume_entry", isRecommended: false }), {
    chipLabel: "이어서 작업",
    metadata: null,
  });
  assert.deepEqual(getLessonHeaderStatus({ entryState: "revisit_entry", isRecommended: false }), {
    chipLabel: "다시 보기",
    metadata: null,
  });
  assert.deepEqual(getLessonHeaderStatus({ entryState: "first_entry", isRecommended: true }), {
    chipLabel: "현재 교시",
    metadata: "추천 흐름에서 바로 시작한 교시예요.",
  });
});

test("getLessonStepLabel supports regular lesson and free mode", () => {
  assert.equal(getLessonStepLabel(0), "자유모드");
  assert.equal(getLessonStepLabel(3), "3교시");
});
