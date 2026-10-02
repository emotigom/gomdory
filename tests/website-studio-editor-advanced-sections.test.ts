import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("advanced sections are collapsed and secondary", () => {
  const source = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.match(source, /<details/);
  assert.match(source, /4\. 코드 이해/);
  assert.match(source, /5\. AI 도움과 공유 준비/);
});

test("editor shell does not import webllm runtime packages", () => {
  const source = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.doesNotMatch(source, /@mlc-ai\/web-llm/);
});
