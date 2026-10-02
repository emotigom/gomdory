import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("canonical board CTA uses route helper instead of legacy classroom/new", () => {
  const src = fs.readFileSync("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx", "utf8");
  assert.match(src, /teacherAiCourseNewHref\(\{ boardId \}\)/);
  assert.doesNotMatch(src, /\/edu\/teacher\/classroom\/new\?boardId=/);
});
