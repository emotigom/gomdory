import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");

test("teacher gallery has compact filter and sort controls", () => {
  assert.match(teacherClient, /Day 1/);
  assert.match(teacherClient, /Day 2/);
  assert.match(teacherClient, /Day 3/);
  assert.match(teacherClient, /Day 4/);
  assert.match(teacherClient, /기타/);
  assert.match(teacherClient, /최신순/);
  assert.match(teacherClient, /오래된순/);
  assert.match(teacherClient, /publishedAt \?\? site\.updatedAt/);
});
