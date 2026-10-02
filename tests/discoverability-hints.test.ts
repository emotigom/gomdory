import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowHint } from "@/lib/dashboard/discoverabilityHints";

test("shouldShowHint returns true only when enabled and unseen", () => {
  assert.equal(shouldShowHint({ enabled: true, hasSeen: false }), true);
  assert.equal(shouldShowHint({ enabled: false, hasSeen: false }), false);
  assert.equal(shouldShowHint({ enabled: true, hasSeen: true }), false);
  assert.equal(shouldShowHint({ enabled: false, hasSeen: true }), false);
});
