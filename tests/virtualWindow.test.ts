import assert from "node:assert/strict";
import test from "node:test";

import { computeWindow } from "@/lib/ui/virtualWindow";

test("computeWindow returns empty window when no items", () => {
  const result = computeWindow({
    itemCount: 0,
    itemHeightEstimate: 120,
    scrollTop: 100,
    viewportHeight: 600,
    overscan: 3,
  });

  assert.deepEqual(result, { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 });
});

test("computeWindow keeps bounds and spacer sums consistent", () => {
  const itemCount = 100;
  const itemHeightEstimate = 120;
  const result = computeWindow({
    itemCount,
    itemHeightEstimate,
    scrollTop: 960,
    viewportHeight: 480,
    overscan: 2,
  });

  assert.ok(result.start >= 0);
  assert.ok(result.end <= itemCount);
  assert.ok(result.end > result.start);
  assert.equal(result.topSpacer + result.bottomSpacer + (result.end - result.start) * itemHeightEstimate, itemCount * itemHeightEstimate);
});

test("computeWindow expands to include active index", () => {
  const result = computeWindow({
    itemCount: 20,
    itemHeightEstimate: 100,
    scrollTop: 0,
    viewportHeight: 200,
    overscan: 1,
    includeIndex: 15,
  });

  assert.ok(result.start <= 15);
  assert.ok(result.end > 15);
});
