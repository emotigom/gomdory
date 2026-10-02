import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("action audit doc reflects real button states with no fake-active entries", () => {
  const src = fs.readFileSync("docs/edu/AI_WEBSITE_STUDIO_ACTION_AUDIT.md", "utf8");
  assert.match(src, /working/);
  assert.match(src, /fixed/);
  assert.match(src, /disabled/);
  assert.match(src, /이어서 만들기/);
  assert.match(src, /복제/);
  assert.match(src, /삭제/);
  assert.match(src, /공유 링크 만들기/);
  assert.match(src, /Fake-active 버튼 금지/);
});
