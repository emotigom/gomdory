import test from "node:test";
import assert from "node:assert/strict";
import { buildAiCoursewareSrcDoc, buildAiCoursewareStorageKey } from "@/lib/edu/courseware/aiCoursewareWorkspace";

test("workspace utilities include day in storage key and srcDoc content", () => {
  assert.equal(buildAiCoursewareStorageKey(16, "board-1"), "gomdory.aiCourseware.day.16.board-1.v1");
  const src = buildAiCoursewareSrcDoc("<h1>Hello</h1>", "h1{color:red;}", "console.log('ok')");
  assert.match(src, /<style>h1\{color:red;\}<\/style>/);
  assert.match(src, /<h1>Hello<\/h1>/);
  assert.match(src, /console\.log\('ok'\)/);
});
