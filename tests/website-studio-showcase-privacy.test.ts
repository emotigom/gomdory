import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("showcase renders only board-scoped published snapshots and avoids webllm imports", () => {
  const route = fs.readFileSync("app/edu/lesson/teacher/showcase/page.tsx", "utf8");
  const showcase = fs.readFileSync("app/edu/lesson/teacher/showcase/ShowcaseClient.tsx", "utf8");
  assert.match(route, /getPublishedWebsiteStudioSitesForBoard/);
  assert.match(route, /publishedSites/);
  assert.match(showcase, /CANONICAL_BASE_URL/);
  assert.match(showcase, /`\$\{CANONICAL_BASE_URL\}\/w\/\$\{site\.slug\}`/);
  assert.doesNotMatch(showcase, /@mlc-ai\/web-llm|WebLLM/i);
  assert.doesNotMatch(showcase, /prompt|response|owner email/i);
});
