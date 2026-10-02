import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");

test("advanced export section is collapsible and secondary", () => {
  assert.ok(source.includes("<details"));
  assert.ok(source.includes("고급: HTML/CSS 내보내기"));
  assert.ok(source.includes("수업 자료나 백업이 필요할 때만 사용하세요."));
  assert.ok(source.includes("HTML 복사"));
  assert.ok(source.includes("CSS 복사"));
  assert.ok(source.includes("전체 문서 복사"));
  assert.ok(source.includes("index.html 다운로드"));
});
