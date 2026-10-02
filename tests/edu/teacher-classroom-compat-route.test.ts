import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("legacy classroom new route is implemented as redirect compatibility page", () => {
  const src = fs.readFileSync("app/edu/teacher/classroom/new/page.tsx", "utf8");
  assert.match(src, /export default async function/);
  assert.match(src, /redirect\(/);
  assert.match(src, /teacherAiCourseNewHref/);
  assert.match(src, /await searchParams/);
  assert.doesNotMatch(src, /searchParams\?:\s*\{\s*boardId\?:/);
});
