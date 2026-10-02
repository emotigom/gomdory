import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("review and editor are non-ai core flow surfaces", () => {
  const review = fs.readFileSync("app/dashboard/websites/[siteId]/review/WebsiteStudioReviewClient.tsx", "utf8");
  const editor = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.doesNotMatch(review, /@mlc-ai\/web-llm/);
  assert.doesNotMatch(editor, /@mlc-ai\/web-llm/);
});
