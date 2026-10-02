import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const studio = fs.readFileSync("app/edu/lesson/_components/studio/Day01LessonStudio.tsx", "utf8");
const canonical = fs.readFileSync("app/edu/lesson/CoursewareStudioCanonicalClient.tsx", "utf8");
const studentRuntime = fs.readFileSync("app/edu/lesson/day/[day]/StudentLessonRuntimeClient.tsx", "utf8");
const studentDayRoute = fs.readFileSync("app/edu/lesson/day/[day]/page.tsx", "utf8");

test("day01 studio has runtime and asset markers", () => {
  assert.ok(studio.includes('data-courseware-runtime="ai-bingo-role-studio-v1"'));
  assert.ok(studio.includes('data-lesson-id="day-1"'));
  assert.ok(studio.includes('data-lesson-volume="45-minute"'));
  assert.ok(studio.includes('data-courseware-assets="assets-gomdory-day01-v1"'));
});

test("day01 runtime contract uses stable markers and day-1 route wiring", () => {
  assert.ok(canonical.includes('data-courseware-runtime="lesson-hub-v2"'));
  assert.ok(canonical.includes('data-marker-version="ai-courseware-v1"'));
  assert.ok(canonical.includes('coursewareLessonHref(resolvedActiveDay)'));
  assert.ok(studentDayRoute.includes('data-courseware-day-runtime="student-day-v2"'));
  assert.ok(studentRuntime.includes('data-marker-version="ai-courseware-v1"'));
  assert.ok(studentRuntime.includes('진행 모드'));
  assert.ok(studentRuntime.includes('전체 보기'));
  assert.ok(studentRuntime.includes('이전 활동'));
  assert.ok(studentRuntime.includes('다음 활동'));
  assert.ok(studentRuntime.includes('오늘의 도구 흐름'));
});

test("legacy textarea code studio strings are absent", () => {
  for (const t of ["수업 스튜디오", "HTML textarea", "CSS textarea", "JS textarea", "로컬 저장", "코드 복사"]) {
    assert.equal(studio.includes(t), false);
  }
});
