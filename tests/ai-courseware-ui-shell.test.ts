import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getAllCoursewareLessons, getCoursewareLessonsByDay, getStarterTemplates } from "../lib/edu/courseware/aiCoursewareSelectors";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("canonical client includes runtime markers", () => {
  const canonicalClient = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(canonicalClient, /data-courseware-runtime="ai-courseware-canonical"/);
  assert.match(canonicalClient, /data-marker-version="ai-courseware-v1"/);
});

test("registry-driven totals and day grouping remain 32 lessons / 16 days", () => {
  const lessons = getAllCoursewareLessons();
  assert.equal(lessons.length, 32);
  assert.equal(new Set(lessons.map((lesson) => lesson.dayNumber)).size, 16);
  assert.deepEqual(getCoursewareLessonsByDay(1).map((lesson) => lesson.lessonNumber), [1, 2]);
  assert.deepEqual(getCoursewareLessonsByDay(16).map((lesson) => lesson.lessonNumber), [31, 32]);
});

test("lesson cards can be populated with required mission fields", () => {
  for (const lesson of getAllCoursewareLessons()) {
    assert.ok(lesson.lessonNumber);
    assert.ok(lesson.titleKo);
    assert.ok(lesson.oneLineActivityKo);
    assert.ok(lesson.artifact.labelKo);
    assert.ok(lesson.toolHints.length >= 1);
  }
});

test("recovery pack and starter template section are populated", () => {
  const lesson = getAllCoursewareLessons()[0];
  assert.ok(lesson.recovery.summaryKo);
  assert.ok(lesson.recovery.catchUpStepsKo.length >= 1);
  assert.equal(getStarterTemplates().length, 5);
});

test("ui shell copy keeps WebLLM optional wording", () => {
  const canonicalClient = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(canonicalClient, /WebLLM은 선택 사항/);
  assert.doesNotMatch(canonicalClient, /WebLLM은 필수/);
});

test("ui component files do not duplicate 32-lesson seed literal", () => {
  const files = [
    "CoursewareStudioCanonicalClient.tsx",
    "_components/CoursewareHero.tsx",
    "_components/CoursewareDayRail.tsx",
    "_components/CoursewareDayCard.tsx",
    "_components/CoursewareLessonCard.tsx",
  ].map((file) => read("app", "edu", "lesson", ...file.split("/")));

  for (const source of files) {
    assert.doesNotMatch(source, /lesson-01-ai-bingo/);
    assert.doesNotMatch(source, /lesson-32-reflection-card/);
  }
});

test("empty-state fallback copy exists to avoid blank screen", () => {
  const canonicalClient = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(canonicalClient, /빈 화면 대신 안내/);
});
