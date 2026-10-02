import assert from "node:assert/strict";
import test from "node:test";

import {
  getOrderedCoreLessonIds,
  getProgressA11yLabel,
  resolveLessonProgressState,
  resolveRecommendedLessonId,
} from "@/app/edu/lesson/lessonListProgress";

test("resolveRecommendedLessonId chooses next lesson from active core lesson", () => {
  const orderedCoreLessonIds = [1, 2, 3, 4];
  assert.equal(resolveRecommendedLessonId({ orderedCoreLessonIds, activeLessonId: 2 }), 3);
});

test("resolveRecommendedLessonId falls back to first core lesson when active lesson is missing", () => {
  const orderedCoreLessonIds = [1, 2, 3, 4];
  assert.equal(resolveRecommendedLessonId({ orderedCoreLessonIds, activeLessonId: null }), 1);
  assert.equal(resolveRecommendedLessonId({ orderedCoreLessonIds, activeLessonId: 0 }), 1);
});

test("resolveRecommendedLessonId never collides with free mode recommendation", () => {
  const orderedCoreLessonIds = [1, 2, 3, 4];
  assert.equal(resolveRecommendedLessonId({ orderedCoreLessonIds, activeLessonId: 4 }), null);
  assert.equal(resolveRecommendedLessonId({ orderedCoreLessonIds: [], activeLessonId: 0 }), null);
});

test("resolveLessonProgressState prioritizes current then recommended then visited", () => {
  const visitedLessonIds = new Set([1, 2]);

  assert.equal(
    resolveLessonProgressState({ lessonId: 2, activeLessonId: 2, recommendedLessonId: 3, visitedLessonIds }),
    "current",
  );
  assert.equal(
    resolveLessonProgressState({ lessonId: 3, activeLessonId: 2, recommendedLessonId: 3, visitedLessonIds }),
    "recommended_next",
  );
  assert.equal(
    resolveLessonProgressState({ lessonId: 1, activeLessonId: 2, recommendedLessonId: 3, visitedLessonIds }),
    "visited",
  );
  assert.equal(
    resolveLessonProgressState({ lessonId: 4, activeLessonId: 2, recommendedLessonId: 3, visitedLessonIds }),
    "default",
  );
});

test("getOrderedCoreLessonIds keeps 1-4 priority and unknown fallback order", () => {
  assert.deepEqual(
    getOrderedCoreLessonIds([
      { id: 7, title: "7교시" },
      { id: 3, title: "3교시" },
      { id: 1, title: "1교시" },
      { id: 9, title: "9교시" },
    ]),
    [1, 3, 7, 9],
  );
});

test("getProgressA11yLabel exposes screen-reader friendly status copy", () => {
  assert.equal(getProgressA11yLabel("current"), "현재 교시");
  assert.equal(getProgressA11yLabel("recommended_next"), "다음 추천 교시");
  assert.equal(getProgressA11yLabel("visited"), "방문함");
  assert.equal(getProgressA11yLabel("default"), "미방문");
});
