import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("editor layout separates guidance practice and result", () => {
  const source = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.match(source, /1\. 안내/);
  assert.match(source, /2\. 실습/);
  assert.match(source, /3\. 결과/);
  assert.match(source, /오늘의 제작 미션/);
  assert.match(source, /현재 고치는 부분/);
  assert.match(source, /결과 미리보기/);
  assert.match(source, /내용을 바꾸면 오른쪽 미리보기에 바로 반영됩니다/);
});

test("preview frame remains sandboxed without allow-scripts", () => {
  const source = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioPreviewFrame.tsx", "utf8");
  assert.match(source, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(source, /allow-scripts/);
});
