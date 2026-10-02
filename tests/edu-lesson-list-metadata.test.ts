import assert from "node:assert/strict";
import test from "node:test";

import { type LessonCard } from "@/app/edu/lesson/lessonListOrdering";
import {
  getLessonCardA11yLabel,
  getLessonMiniPreviewKind,
  getLessonOutcomeHints,
  getLessonPreviewCopy,
  getLessonStatusCopy,
  normalizeLessonTitle,
} from "@/app/edu/lesson/lessonListUi";

test("getLessonPreviewCopy returns lightweight preview for core lessons and free mode", () => {
  assert.equal(getLessonPreviewCopy({ id: 1, title: "1교시: 자기소개" }), "나를 소개하는 첫 페이지를 만들어요.");
  assert.equal(getLessonPreviewCopy({ id: 2, title: "2교시: 관심사 탐구" }), "좋아하는 주제를 정리하고 소개해요.");
  assert.equal(getLessonPreviewCopy({ id: 3, title: "3교시: 퀴즈/미니게임" }), "간단한 상호작용이나 게임 요소를 넣어봐요.");
  assert.equal(getLessonPreviewCopy({ id: 4, title: "4교시: 작품 전시" }), "완성한 결과물을 보기 좋게 정리해요.");
  assert.equal(getLessonPreviewCopy({ id: 0, title: "자유모드 · 빈 페이지" }), "원하는 내용을 처음부터 자유롭게 만들 수 있어요.");
});

test("getLessonPreviewCopy falls back safely for unknown lesson ids", () => {
  assert.equal(getLessonPreviewCopy({ id: 9, title: "9교시" }), "이 교시 활동을 살펴보고 시작해요.");
});

test("getLessonStatusCopy keeps start/continue guidance concise", () => {
  assert.deepEqual(getLessonStatusCopy({ progressState: "current" }), {
    badge: "현재",
    cue: null,
    a11yStatus: "현재 진행 중",
  });
  assert.deepEqual(getLessonStatusCopy({ progressState: "recommended_next" }), {
    badge: "다음 추천",
    cue: "이어서 하기",
    a11yStatus: "다음 추천",
  });
  assert.deepEqual(getLessonStatusCopy({ progressState: "visited" }), {
    badge: null,
    cue: "다시 보기",
    a11yStatus: "방문함",
  });
  assert.deepEqual(getLessonStatusCopy({ progressState: "default", isFreeMode: true }), {
    badge: null,
    cue: "자유롭게 시작하기",
    a11yStatus: "미방문",
  });
});

test("normalizeLessonTitle keeps fallback title for missing title", () => {
  const blankTitle: LessonCard = { id: 11, title: "" };
  assert.equal(normalizeLessonTitle(blankTitle), "11교시");
});

test("getLessonCardA11yLabel includes title, state, and preview", () => {
  const label = getLessonCardA11yLabel({
    lesson: { id: 4, title: "4교시: 작품 전시" },
    progressState: "recommended_next",
  });
  assert.equal(label, "4교시: 작품 전시 - 다음 추천 - 전시형 결과물 - 완성한 결과물을 보기 좋게 정리해요.");

  const freeModeLabel = getLessonCardA11yLabel({
    lesson: { id: 0, title: "" },
    progressState: "visited",
    isFreeMode: true,
  });
  assert.equal(freeModeLabel, "자유모드 · 빈 페이지 - 방문함 - 빈 캔버스에서 자유 시작 - 원하는 내용을 처음부터 자유롭게 만들 수 있어요.");
});


test("getLessonOutcomeHints provides lightweight result cues", () => {
  assert.deepEqual(getLessonOutcomeHints({ id: 1, title: "1교시" }), ["프로필 카드", "짧은 소개"]);
  assert.deepEqual(getLessonOutcomeHints({ id: 4, title: "4교시" }), ["작품 쇼케이스", "전시 구성"]);
});

test("getLessonOutcomeHints and mini preview kind keep safe fallback for unknown lesson", () => {
  assert.deepEqual(getLessonOutcomeHints({ id: 9, title: "9교시" }), ["결과 미리보기", "직접 구성"]);
  assert.equal(getLessonMiniPreviewKind({ id: 9, title: "9교시" }), "generic");
});

test("free mode mini preview metadata stays distinct", () => {
  assert.deepEqual(getLessonOutcomeHints({ id: 0, title: "" }), ["빈 캔버스", "자유 구성"]);
  assert.equal(getLessonMiniPreviewKind({ id: 0, title: "" }), "blank_canvas");
});
