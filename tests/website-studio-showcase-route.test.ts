import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("showcase route exists and is wired from teacher gallery", () => {
  const route = fs.readFileSync("app/edu/lesson/teacher/showcase/page.tsx", "utf8");
  const client = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");
  assert.match(route, /getPublishedWebsiteStudioSitesForBoard/);
  assert.match(route, /boardId \? await getPublishedWebsiteStudioSitesForBoard\(boardId\) : \[\]/);
  assert.match(client, /발표\/전시 모드 열기/);
  assert.match(client, /\/edu\/lesson\/teacher\/showcase\?boardId=/);
});
