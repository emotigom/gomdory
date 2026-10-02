import assert from "node:assert/strict";
import test from "node:test";

import { buildLineDiff, getDraftStorageKey, normalizeDraftStorageKey } from "@/lib/site-content/opsEditor";

test("normalizeDraftStorageKey normalizes casing and separators", () => {
  assert.equal(normalizeDraftStorageKey(" Community Usage "), "community-usage");
  assert.equal(normalizeDraftStorageKey("site_content@nav"), "site_content-nav");
  assert.equal(normalizeDraftStorageKey("---"), "unknown");
  assert.equal(getDraftStorageKey("Community Usage"), "ops:site-content:draft:community-usage");
});

test("buildLineDiff keeps unchanged text as same entries", () => {
  const diff = buildLineDiff("a\nb", "a\nb");
  assert.equal(diff.length, 2);
  assert.deepEqual(diff.map((line) => line.kind), ["same", "same"]);
  assert.deepEqual(diff.map((line) => line.text), ["a", "b"]);
});

test("buildLineDiff marks removed and added lines around common subsequence", () => {
  const diff = buildLineDiff("alpha\nbeta\ngamma", "alpha\ngamma\ndelta");
  assert.deepEqual(
    diff.map((line) => `${line.kind}:${line.text}`),
    ["same:alpha", "remove:beta", "same:gamma", "add:delta"],
  );
});
