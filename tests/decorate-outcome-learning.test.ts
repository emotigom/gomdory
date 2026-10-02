import assert from "node:assert/strict";
import test from "node:test";

import { toDelayBucket, toPreviewAgeBucket, toSatisfactionProxy } from "@/lib/edu/lesson/decorateOutcomeLearning";

test("outcome learning buckets", () => {
  assert.equal(toDelayBucket(1200), "fast");
  assert.equal(toDelayBucket(5000), "normal");
  assert.equal(toDelayBucket(12000), "slow");
  assert.equal(toPreviewAgeBucket(500), "fresh");
  assert.equal(toPreviewAgeBucket(12000), "aged");
});

test("outcome learning satisfaction proxy", () => {
  assert.equal(toSatisfactionProxy({ applied: true, undoneAfterApply: false, abandonedPreview: false, staleInvalidated: false }), "positive");
  assert.equal(toSatisfactionProxy({ applied: true, undoneAfterApply: true, abandonedPreview: false, staleInvalidated: false }), "negative");
  assert.equal(toSatisfactionProxy({ applied: false, undoneAfterApply: false, abandonedPreview: true, staleInvalidated: false }), "negative");
  assert.equal(toSatisfactionProxy({ applied: false, undoneAfterApply: false, abandonedPreview: false, staleInvalidated: true }), "negative");
});
