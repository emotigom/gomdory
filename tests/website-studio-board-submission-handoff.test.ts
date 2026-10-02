import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");

test("teacher gallery uses submitted wording and safe metadata-only card labels", () => {
  assert.match(teacherClient, /이 보드에서 시작해 제출·공개된 웹사이트입니다\./);
  assert.match(teacherClient, /제출됨/);
  assert.match(teacherClient, /공개중/);
  assert.match(teacherClient, /Day \{site\.originDay\}/);
  assert.doesNotMatch(teacherClient, /owner_email|prompt|response|fullDocument|full_document/);
  assert.doesNotMatch(teacherClient, /@mlc-ai\/web-llm|websiteStudioWebLLMAssistantClient/);
});
