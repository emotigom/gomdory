import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");

test("review groups checks and renders blockers before grouped checklist", () => {
  const blockerIdx = source.indexOf("먼저 고쳐야 할 항목");
  const groupIdx = source.indexOf("확인하면 좋은 것");
  assert.ok(blockerIdx >= 0 && groupIdx >= 0);
  assert.ok(blockerIdx < groupIdx);
  assert.ok(source.includes("필수 내용"));
  assert.ok(source.includes("개인정보와 안전"));
  assert.ok(source.includes("링크와 태그"));
  assert.ok(source.includes("미리보기"));
  assert.ok(source.includes("<details"));
});
