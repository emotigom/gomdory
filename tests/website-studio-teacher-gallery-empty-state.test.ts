import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");

test("teacher gallery empty state has 2-step guidance and website studio CTA", () => {
  assert.match(teacherClient, /학생에게 웹사이트 스튜디오 링크를 공유하세요\./);
  assert.match(teacherClient, /학생이 배포 전 점검 후 공유 링크를 만들면 여기에 표시됩니다\./);
  assert.match(teacherClient, /학생 웹사이트 만들기 열기/);
  assert.match(teacherClient, /\/dashboard\/websites\/new\?boardId=\$\{encodeURIComponent\(boardId\)\}&source=edu-course/);
});
