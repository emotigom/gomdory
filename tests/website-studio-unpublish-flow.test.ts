import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");
const route = fs.readFileSync("app/api/website-studio/publish/[id]/unpublish/route.ts", "utf8");

test("teacher unpublish flow removes site locally and unpublish api keeps requestId", () => {
  assert.match(teacherClient, /setGallerySites\(\(prev\) => prev\.filter\(\(v\) => v\.id !== site\.id\)\)/);
  assert.match(teacherClient, /공개를 중지했습니다\./);
  assert.match(route, /requestId/);
  assert.match(route, /status:\s*"unpublished"/);
});
