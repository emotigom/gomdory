import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync("app/dashboard/boards/[boardId]/board/_components/studentAppLocalPreview.ts", "utf8");
const teacher = readFileSync("app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector.tsx", "utf8");
const gallery = readFileSync("app/s/[code]/_components/StudentAppGalleryPanel.tsx", "utf8");
const serve = readFileSync("lib/student-apps/serveStudentAppDeployment.ts", "utf8");

test("teacher preview iframe uses the minimal sandbox allow list", () => {
  assert.match(teacher, /sandbox="allow-scripts"/);
  const sandboxAttrs = [...teacher.matchAll(/sandbox="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(sandboxAttrs.length >= 1);
  for (const attr of sandboxAttrs) {
    assert.equal(attr, "allow-scripts");
  }
  assert.match(gallery, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(gallery, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(gallery, /allow-top-navigation|allow-popups|allow-forms|allow-downloads/);
  assert.match(gallery, /target="_blank"/);
  assert.match(gallery, /rel="noopener noreferrer"/);
});

test("local preview CSP blocks network and form submission", () => {
  assert.match(preview, /default-src 'none'/);
  assert.match(preview, /connect-src 'none'/);
  assert.match(preview, /form-action 'none'/);
  assert.match(preview, /base-uri 'none'/);
  assert.match(preview, /SKIP_REWRITE_PREFIXES = \["http:\/\/", "https:\/\/", "data:", "blob:", "#", "mailto:", "javascript:", "\/"\]/);
});

test("published HTML CSP blocks external network while allowing known board origins to embed", () => {
  assert.match(serve, /connect-src 'none'/);
  assert.match(serve, /form-action 'none'/);
  assert.match(serve, /object-src 'none'/);
  assert.match(serve, /base-uri 'none'/);
  assert.match(serve, /STUDENT_APP_FRAME_ANCESTORS/);
  assert.doesNotMatch(serve, /frame-ancestors 'none'/);
  assert.match(serve, /permissions-policy/);
});
