import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherPage = fs.readFileSync("app/edu/lesson/teacher/page.tsx", "utf8");
const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");

test("teacher page loads gallery data when boardId exists", () => {
  assert.match(teacherPage, /getPublishedWebsiteStudioSitesForBoard/);
  assert.match(teacherPage, /boardId \? await getPublishedWebsiteStudioSitesForBoard\(boardId\) : \[\]/);
});

test("teacher gallery section + empty state + copy link route", () => {
  assert.match(teacherClient, /학생 웹사이트 작품/);
  assert.match(teacherClient, /아직 공개된 학생 웹사이트가 없습니다\./);
  assert.match(teacherClient, /CANONICAL_BASE_URL/);
  assert.match(teacherClient, /`\$\{CANONICAL_BASE_URL\}\/w\/\$\{slug\}`/);
  assert.match(teacherClient, /링크를 복사했습니다\./);
  assert.doesNotMatch(teacherClient, /websiteStudioWebLLMAssistantClient|@mlc-ai\/web-llm/);
});
