import assert from "node:assert/strict";
import test from "node:test";

import { calculateBytesSaved, shouldOptimize } from "@/lib/media/optimizationPolicy";

test("shouldOptimize skips gif images", () => {
  assert.equal(shouldOptimize("image/gif"), false);
  assert.equal(shouldOptimize("image/jpeg"), true);
  assert.equal(shouldOptimize("image/png"), true);
  assert.equal(shouldOptimize("text/plain"), false);
});

test("calculateBytesSaved clamps to zero", () => {
  assert.equal(calculateBytesSaved(1200, 900), 300);
  assert.equal(calculateBytesSaved(900, 1200), 0);
  assert.equal(calculateBytesSaved(null, 100), 0);
});
