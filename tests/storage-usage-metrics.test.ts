import assert from "node:assert/strict";
import test from "node:test";

import { computeStorageUsageMetrics } from "@/lib/data/storageUsageMetrics";

test("computeStorageUsageMetrics groups by object key", () => {
  const metrics = computeStorageUsageMetrics([
    { id: "1", objectKey: "o1", bytesStored: 100, bytesOriginal: 200 },
    { id: "2", objectKey: "o1", bytesStored: 100, bytesOriginal: 200 },
    { id: "3", objectKey: null, bytesStored: 50, bytesOriginal: 50 },
    { id: "4", objectKey: null, bytesStored: 70, bytesOriginal: 120 },
  ]);

  assert.equal(metrics.logicalStoredBytes, 320);
  assert.equal(metrics.physicalStoredBytes, 220);
  assert.equal(metrics.originalBytesNoDup, 370);
  assert.equal(metrics.dedupSavingsBytes, 100);
  assert.equal(metrics.optimizeSavingsBytes, 150);
});
