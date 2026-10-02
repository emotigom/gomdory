import assert from "node:assert/strict";
import test from "node:test";

import {
  isLessonCardNavigating,
  resolveLessonCardInteractionProps,
} from "@/app/edu/lesson/lessonListInteraction";
import { getLessonCardA11yLabel } from "@/app/edu/lesson/lessonListUi";

test("interaction hierarchy keeps current stronger than recommended and free mode", () => {
  const current = resolveLessonCardInteractionProps({
    isActive: true,
    progressState: "current",
    isNavigating: false,
  });
  const recommended = resolveLessonCardInteractionProps({
    isActive: false,
    progressState: "recommended_next",
    isNavigating: false,
  });
  const free = resolveLessonCardInteractionProps({
    isActive: false,
    progressState: "default",
    isFreeMode: true,
    isNavigating: false,
  });

  assert.match(current.rootClassName, /border-sky-300/);
  assert.match(current.cueClassName, /text-sky-600/);
  assert.match(recommended.rootClassName, /border-violet-200/);
  assert.match(recommended.cueClassName, /text-violet-600/);
  assert.match(free.rootClassName, /from-sky-50\/80 to-violet-50\/70/);
});

test("pending navigation helper resolves only matching lesson id", () => {
  assert.equal(isLessonCardNavigating(2, 2), true);
  assert.equal(isLessonCardNavigating(2, 3), false);
  assert.equal(isLessonCardNavigating(2, null), false);
});

test("navigating state adds stable click-feedback classes", () => {
  const navigating = resolveLessonCardInteractionProps({
    isActive: false,
    progressState: "visited",
    isNavigating: true,
  });

  assert.match(navigating.rootClassName, /data-\[navigating=true\]:scale-\[0\.995\]/);
  assert.match(navigating.rootClassName, /shadow-\[0_18px_38px_-28px_rgba\(15,23,42,0\.55\)\]/);
  assert.match(navigating.arrowClassName, /translate-x-0\.5/);
});

test("free mode and core lesson a11y labels remain stable after interaction helper additions", () => {
  const freeLabel = getLessonCardA11yLabel({
    lesson: { id: 0, title: "자유모드" },
    progressState: "visited",
    isFreeMode: true,
  });
  const coreLabel = getLessonCardA11yLabel({
    lesson: { id: 2, title: "2교시" },
    progressState: "recommended_next",
  });

  assert.equal(freeLabel, "자유모드 - 방문함 - 빈 캔버스에서 자유 시작 - 원하는 내용을 처음부터 자유롭게 만들 수 있어요.");
  assert.equal(coreLabel, "2교시 - 다음 추천 - 관심사 탐색 결과물 - 좋아하는 주제를 정리하고 소개해요.");
});
