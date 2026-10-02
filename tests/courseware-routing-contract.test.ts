import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AI_COURSEWARE_LESSON_PACKS } from "../lib/edu/courseware/aiCoursewareLessonPacks";
import { resolveCoursewareActiveDay } from "../lib/edu/courseware/aiCoursewareConfig";

test("active day defaults and query override", () => {
  assert.equal(resolveCoursewareActiveDay(), 1);
  assert.equal(resolveCoursewareActiveDay({ searchParamsDay: "9" }), 9);
});

test("32 distinct lesson packs with required fields", () => {
  assert.equal(AI_COURSEWARE_LESSON_PACKS.length, 32);
  const titles = new Set(AI_COURSEWARE_LESSON_PACKS.map((x) => x.title));
  assert.equal(titles.size, 32);
  for (const lesson of AI_COURSEWARE_LESSON_PACKS) {
    assert.ok(lesson.title.trim());
    assert.ok(lesson.essentialQuestion.trim());
    assert.ok(lesson.studentOutcome.trim());
    assert.ok(lesson.artifact.trim());
    assert.ok(lesson.phases.length >= 4);
    assert.ok(lesson.teacherPrep.length > 0);
    assert.ok(lesson.studentTasks.length > 0);
    assert.ok(lesson.extensionTasks.length > 0);
    assert.ok(lesson.recoveryPath.length > 0);
  }
});

test("hub/day/teacher routes keep runtime markers and CTA wiring", () => {
  const hub = fs.readFileSync("app/edu/lesson/CoursewareStudioCanonicalClient.tsx", "utf8");
  assert.match(hub, /data-courseware-runtime="lesson-hub-v2"/);
  assert.match(hub, /coursewareLessonHref\(resolvedActiveDay\)/);
  assert.match(hub, /coursewareTeacherLessonHref\(resolvedActiveDay\)/);
  assert.match(hub, /모두 펼치기/);
  assert.match(hub, /모두 접기/);
  assert.match(hub, /미리보기/);

  const day = fs.readFileSync("app/edu/lesson/day/[day]/page.tsx", "utf8");
  assert.match(day, /data-courseware-day-runtime="student-day-v2"/);
  const teacher = fs.readFileSync("app/edu/lesson/teacher/day/[day]/page.tsx", "utf8");
  assert.match(teacher, /data-courseware-teacher-runtime="teacher-day-v2"/);
});

test("no hardcoded day 9 default in hub", () => {
  const hub = fs.readFileSync("app/edu/lesson/CoursewareStudioCanonicalClient.tsx", "utf8");
  assert.doesNotMatch(hub, /searchParamsDay:\s*"9"/);
  assert.doesNotMatch(hub, /resolvedActiveDay\s*=\s*9/);
});
