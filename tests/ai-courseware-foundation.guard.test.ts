import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("canonical courseware route is owned by CoursewareStudioCanonicalClient", () => {
  const lessonPage = read("app", "edu", "lesson", "page.tsx");
  const canonicalClient = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");

  assert.match(lessonPage, /import CoursewareStudioCanonicalClient from "\.\/CoursewareStudioCanonicalClient"/);
  assert.match(canonicalClient, /data-courseware-runtime="ai-courseware-canonical"/);
  assert.match(canonicalClient, /data-marker-version="ai-courseware-v1"/);
  assert.match(canonicalClient, /CoursewareStudioCanonicalClient/);
});

test("starter-template 4-lesson labels remain present", () => {
  const lessons = read("lib", "edu", "lessons.ts");
  assert.match(lessons, /1교시/);
  assert.match(lessons, /2교시/);
  assert.match(lessons, /3교시/);
  assert.match(lessons, /4교시/);
  assert.match(lessons, /자유모드/);
});
