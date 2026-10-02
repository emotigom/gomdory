import assert from "node:assert/strict";
import test from "node:test";

import {
  getLessonEntryA11ySummary,
  getLessonEntryGuidanceCopy,
  getLessonFirstActionHint,
  resolveLessonEntryState,
  resolveRecommendedCoreLessonId,
} from "@/app/edu/lesson/lessonEntryUi";

test("resolveLessonEntryState separates first, resume, free mode, and revisit entries", () => {
  assert.equal(
    resolveLessonEntryState({ lessonId: 1, wasVisited: false, hasSavedProgress: false, isFreeMode: false }),
    "first_entry",
  );
  assert.equal(
    resolveLessonEntryState({ lessonId: 2, wasVisited: true, hasSavedProgress: true, isFreeMode: false }),
    "resume_entry",
  );
  assert.equal(
    resolveLessonEntryState({ lessonId: 3, wasVisited: true, hasSavedProgress: false, isFreeMode: false }),
    "revisit_entry",
  );
  assert.equal(
    resolveLessonEntryState({ lessonId: 0, wasVisited: false, hasSavedProgress: false, isFreeMode: true }),
    "free_mode_entry",
  );
});

test("getLessonEntryGuidanceCopy differentiates first entry and resume entry", () => {
  const first = getLessonEntryGuidanceCopy({ lessonId: 1, entryState: "first_entry", isRecommended: true });
  const resume = getLessonEntryGuidanceCopy({ lessonId: 1, entryState: "resume_entry", isRecommended: false });

  assert.equal(first.eyebrow, "교시 시작");
  assert.match(first.title, /결과물/);
  assert.equal(first.continuity, "지금 시작하기 좋은 추천 교시에요.");

  assert.equal(resume.eyebrow, "이어하기");
  assert.match(resume.title, /이어서/);
  assert.equal(resume.continuity, null);
});

test("getLessonEntryGuidanceCopy keeps free mode entry meaning explicit", () => {
  const freeMode = getLessonEntryGuidanceCopy({ lessonId: 0, entryState: "free_mode_entry", isRecommended: false });
  assert.equal(freeMode.eyebrow, "자유 시작");
  assert.match(freeMode.title, /빈 페이지/);
  assert.match(freeMode.support, /직접 구성/);
});

test("getLessonFirstActionHint returns lightweight first action cue per lesson", () => {
  assert.match(getLessonFirstActionHint(1), /핵심 내용/);
  assert.match(getLessonFirstActionHint(2), /주제|소재/);
  assert.match(getLessonFirstActionHint(3), /상호작용|퀴즈/);
  assert.match(getLessonFirstActionHint(4), /결과물/);
  assert.match(getLessonFirstActionHint(0), /빈 페이지/);
  assert.match(getLessonFirstActionHint(99), /핵심 한 줄/);
});

test("a11y summary helper keeps guidance concise", () => {
  const summary = getLessonEntryA11ySummary({
    lessonStepLabel: "2교시",
    lessonTitle: "관심 주제 탐색",
    entryState: "resume_entry",
    workspaceContext: "관심 주제를 정리하고 전달 흐름을 잡는 교시예요.",
    firstActionHint: "관심 주제를 하나 정해보세요.",
  });

  assert.equal(
    summary,
    "2교시 관심 주제 탐색. 이어하기. 공간 안내: 관심 주제를 정리하고 전달 흐름을 잡는 교시예요. 첫 행동: 관심 주제를 하나 정해보세요.",
  );
});

test("resolveRecommendedCoreLessonId follows first unvisited core lesson", () => {
  assert.equal(resolveRecommendedCoreLessonId(new Set<number>([])), 1);
  assert.equal(resolveRecommendedCoreLessonId(new Set<number>([1, 2])), 3);
  assert.equal(resolveRecommendedCoreLessonId(new Set<number>([1, 2, 3, 4])), null);
});
