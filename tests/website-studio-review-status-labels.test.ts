import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");

test("review uses Korean status labels in visible UI mappings", () => {
  assert.ok(source.includes("공개 가능"));
  assert.ok(source.includes("공개 불가"));
  assert.ok(source.includes("차단"));
  assert.ok(source.includes("확인 필요"));
  assert.ok(source.includes("통과"));
  assert.ok(source.includes("확인 후 공개 가능"));
});
