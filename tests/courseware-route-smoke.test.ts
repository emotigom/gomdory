import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const hub = fs.readFileSync("app/edu/lesson/CoursewareStudioCanonicalClient.tsx", "utf8");
const studentDayRoute = fs.readFileSync("app/edu/lesson/day/[day]/page.tsx", "utf8");
const teacherDayRoute = fs.readFileSync("app/edu/lesson/teacher/day/[day]/page.tsx", "utf8");

test("hero contains course title and CTA", () => {
  assert.ok(hub.includes('data-courseware-runtime="lesson-hub-v2"'));
  assert.ok(hub.includes("중학생 AI + 웹 제작 코스웨어 허브"));
  assert.ok(hub.includes("오늘 수업 시작"));
});

test("active lesson command panel exposes core teaching metadata", () => {
  assert.ok(hub.includes("Active lesson command panel"));
  assert.ok(hub.includes("핵심 질문"));
  assert.ok(hub.includes("결과물 ·"));
  assert.ok(hub.includes("빠른 운영"));
  assert.ok(hub.includes("기본 운영"));
  assert.ok(hub.includes("확장 운영 120–180분"));
  assert.ok(hub.includes("도입 → 개념 → 실습 → 제작 → 공유 → 회고 → 확장"));
});

test("course map controls and day actions are present", () => {
  assert.ok(hub.includes("모두 펼치기"));
  assert.ok(hub.includes("모두 접기"));
  assert.ok(hub.includes("lesson.route"));
  assert.ok(hub.includes("lesson.teacherRoute"));
  assert.ok(hub.includes("미리보기"));
});

test("student and teacher day routes render dedicated runtime markers", () => {
  assert.ok(studentDayRoute.includes('data-courseware-day-runtime="student-day-v2"'));
  assert.ok(teacherDayRoute.includes('data-courseware-teacher-runtime="teacher-day-v2"'));
});
