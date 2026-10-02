import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");

test("review layout follows classroom hierarchy and blocked CTA", () => {
  assert.ok(source.includes("웹사이트 공개 전 점검"));
  assert.ok(source.includes("먼저 고쳐야 할 항목"));
  assert.ok(source.includes("확인하면 좋은 것"));
  assert.ok(source.includes("결과 미리보기"));
  assert.ok(source.includes("공유 링크 만들기"));
  assert.ok(source.includes("고급: HTML/CSS 내보내기"));
  assert.ok(source.includes("아직 공개할 수 없습니다"));
  assert.ok(source.includes("편집으로 돌아가기"));
});
