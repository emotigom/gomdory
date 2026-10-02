import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLessonTitle, resolveActiveLessonId } from "@/app/edu/lesson/lessonListUi";

test("resolveActiveLessonId returns lesson id from edu lesson pathname", () => {
  assert.equal(resolveActiveLessonId("/edu/lesson/2"), 2);
  assert.equal(resolveActiveLessonId("/edu/lesson/0"), 0);
  assert.equal(resolveActiveLessonId("/edu"), null);
  assert.equal(resolveActiveLessonId(null), null);
});

test("normalizeLessonTitle protects against blank titles", () => {
  assert.equal(normalizeLessonTitle({ id: 0, title: " " }), "자유모드 · 빈 페이지");
  assert.equal(normalizeLessonTitle({ id: 3, title: " " }), "3교시");
  assert.equal(normalizeLessonTitle({ id: 3, title: "3교시: 퀴즈" }), "3교시: 퀴즈");
});
