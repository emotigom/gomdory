import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("review publish UI has privacy confirmation copy", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");
  assert.equal(source.includes("개인정보로 보일 수 있는 내용을 선생님과 확인했습니다."), true);
});
