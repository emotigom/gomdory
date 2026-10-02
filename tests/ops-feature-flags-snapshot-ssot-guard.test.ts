import assert from "node:assert/strict";
import test from "node:test";

import { PUBLIC_FLAGS_REGISTRY } from "@/lib/dashboard/featureFlags";
import { FEATURE_FLAG_SNAPSHOT } from "@/lib/ops/featureFlagsSnapshot";

test("ops feature flags snapshot is derived solely from PUBLIC_FLAGS_REGISTRY", () => {
  assert.equal(FEATURE_FLAG_SNAPSHOT.length, PUBLIC_FLAGS_REGISTRY.length);

  const snapshotRows = FEATURE_FLAG_SNAPSHOT.map((item) => ({
    key: item.key,
    meaning: item.meaning,
  }));
  const registryRows = PUBLIC_FLAGS_REGISTRY.map((item) => ({
    key: item.flagName,
    meaning: item.snapshotMeaning,
  }));

  assert.deepEqual(snapshotRows, registryRows);
});
