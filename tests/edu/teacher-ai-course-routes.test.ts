import assert from "node:assert/strict";
import test from "node:test";

import { TEACHER_AI_COURSE_CANONICAL_PATH, TEACHER_AI_COURSE_LEGACY_PATH, teacherAiCourseNewHref } from "@/lib/edu/teacherCourseRoutes";

test("teacherAiCourseNewHref uses canonical path and preserves boardId", () => {
  assert.equal(teacherAiCourseNewHref({ boardId: "board-123" }), `${TEACHER_AI_COURSE_CANONICAL_PATH}?boardId=board-123`);
  assert.equal(teacherAiCourseNewHref(), TEACHER_AI_COURSE_CANONICAL_PATH);
  assert.equal(TEACHER_AI_COURSE_LEGACY_PATH, "/edu/teacher/classroom/new");
});
