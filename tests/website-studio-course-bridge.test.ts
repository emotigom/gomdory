import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const teacherPath = path.join(process.cwd(), "app", "edu", "lesson", "teacher", "CoursewareTeacherDashboardClient.tsx");

test("teacher page builds website studio href with and without boardId", () => {
  const source = fs.readFileSync(teacherPath, "utf8");
  assert.match(source, /\/dashboard\/websites\/new\?boardId=\$\{encodeURIComponent\(boardId\)\}&source=edu-course/);
  assert.match(source, /"\/dashboard\/websites\/new\?source=edu-course"/);
});

test("teacher page includes day website bridge link", () => {
  const source = fs.readFileSync(teacherPath, "utf8");
  assert.match(source, /source=day-website&day=\$\{selectedDayNumber\}/);
  assert.match(source, /이 Day로 웹사이트 만들기/);
});
