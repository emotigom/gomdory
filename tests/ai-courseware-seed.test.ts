import assert from "node:assert/strict";
import test from "node:test";

import { AI_COURSEWARE_LESSONS } from "../lib/edu/courseware/aiCoursewareLessons";
import {
  getCoursewareLessonsByDay,
  getNextCoursewareLesson,
  getPreviousCoursewareLesson,
  getStarterTemplates,
  mapStarterTemplateToCoursewareLessons,
} from "../lib/edu/courseware/aiCoursewareSelectors";
import { COURSEWARE_ARTIFACT_TYPES } from "../lib/edu/courseware/aiCoursewareTypes";

test("registry has exactly 32 lessons with contiguous lessonNumber", () => {
  assert.equal(AI_COURSEWARE_LESSONS.length, 32);
  assert.deepEqual(
    AI_COURSEWARE_LESSONS.map((lesson) => lesson.lessonNumber),
    Array.from({ length: 32 }, (_, i) => i + 1),
  );
});

test("day numbering is 1..16 and each day has exactly 2 lessons", () => {
  const grouped = new Map<number, number[]>();
  for (const lesson of AI_COURSEWARE_LESSONS) {
    const entries = grouped.get(lesson.dayNumber) ?? [];
    entries.push(lesson.lessonNumber);
    grouped.set(lesson.dayNumber, entries);
  }

  assert.deepEqual(Array.from(grouped.keys()).sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i + 1));
  for (const list of grouped.values()) {
    assert.equal(list.length, 2);
  }
});

test("lesson seed completeness and valid artifact types", () => {
  for (const lesson of AI_COURSEWARE_LESSONS) {
    assert.equal(Boolean(lesson.titleKo), true);
    assert.equal(Boolean(lesson.oneLineActivityKo), true);
    assert.equal(lesson.toolHints.length >= 1 && lesson.toolHints.length <= 3, true);
    assert.equal(Boolean(lesson.artifact.type), true);
    assert.equal(Boolean(lesson.artifact.labelKo), true);
    assert.equal(Boolean(lesson.recovery.summaryKo), true);
    assert.equal(lesson.recovery.catchUpStepsKo.length > 0, true);
    assert.equal(COURSEWARE_ARTIFACT_TYPES.includes(lesson.artifact.type), true);
  }
});

test("day selector and lesson navigation boundaries", () => {
  assert.deepEqual(
    getCoursewareLessonsByDay(1).map((lesson) => lesson.lessonNumber),
    [1, 2],
  );
  assert.deepEqual(
    getCoursewareLessonsByDay(16).map((lesson) => lesson.lessonNumber),
    [31, 32],
  );
  assert.equal(getNextCoursewareLesson(32), null);
  assert.equal(getPreviousCoursewareLesson(1), null);
});

test("starter templates are retained and mapped", () => {
  const templates = getStarterTemplates();
  assert.equal(templates.length, 5);
  const selfIntro = templates.find((template) => template.titleKo === "자기소개");
  assert.ok(selfIntro);
  assert.deepEqual(selfIntro.mapsToLessonNumbers, [19, 21, 22]);
  assert.deepEqual(
    mapStarterTemplateToCoursewareLessons("starter-quiz-minigame").map((lesson) => lesson.lessonNumber),
    [13, 14, 25],
  );
});

test("WebLLM is not required by lesson tool hints", () => {
  for (const lesson of AI_COURSEWARE_LESSONS) {
    const normalized = lesson.toolHints.join(" ").toLowerCase();
    assert.equal(normalized.includes("webllm"), false);
  }
});
