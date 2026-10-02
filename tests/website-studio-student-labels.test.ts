import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("student facing korean block labels are present", () => {
  const source = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  ["첫 화면", "설명 글", "카드 묶음", "퀴즈", "링크 버튼", "마무리"].forEach((label) => {
    assert.match(source, new RegExp(label));
  });
});
