import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt/response are not written to localStorage", () => {
  const src = readFileSync("lib/website-studio/websiteStudioLocalStore.ts", "utf8");
  assert.doesNotMatch(src, /prompt|response|assistantRaw|modelOutput/i);
});

test("assistant client stores only validated suggestion metadata in component state", () => {
  const src = readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.doesNotMatch(src, /localStorage\.|setItem\(/);
  assert.doesNotMatch(src, /JSON\.stringify\(prompt\)|JSON\.stringify\(raw\)/);
});
