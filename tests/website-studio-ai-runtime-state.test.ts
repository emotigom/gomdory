import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("runtime state: duplicate runs blocked and action buttons disabled while running", () => {
  const src = readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.match(src, /if \(runInFlightRef\.current\) return/);
  assert.match(src, /disabled=\{runInFlightRef\.current\}/);
});

test("runtime state: selection change clears stale suggestion", () => {
  const src = readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.match(src, /setSelected\(i\);\s*setSuggestion\(null\);\s*setSuggestionMeta\(null\);/);
});
