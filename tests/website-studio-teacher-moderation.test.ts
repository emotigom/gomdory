import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");

test("teacher gallery renders moderation controls and safe error handling", () => {
  assert.match(teacherClient, /공개 중지/);
  assert.match(teacherClient, /이 웹사이트의 공개를 중지할까요\? 학생이 받은 공개 링크에서는 더 이상 보이지 않습니다\./);
  assert.match(teacherClient, /\/api\/website-studio\/publish\/\$\{site\.id\}\/unpublish/);
  assert.match(teacherClient, /requestId/);
  assert.doesNotMatch(teacherClient, /@mlc-ai\/web-llm|websiteStudioWebLLMAssistantClient/);
});
