import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("editor uses student facing korean block labels", () => {
  const source = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  ["첫 화면", "설명 글", "카드 묶음", "퀴즈", "링크 버튼", "마무리", "이미지"].forEach((label) => assert.match(source, new RegExp(label)));
  assert.doesNotMatch(source, />\s*hero\s*</);
  assert.doesNotMatch(source, />\s*text\s*</);
  assert.doesNotMatch(source, />\s*cardGrid\s*</);
  assert.doesNotMatch(source, />\s*footer\s*</);
});
