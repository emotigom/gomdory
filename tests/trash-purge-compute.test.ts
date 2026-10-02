import assert from "node:assert/strict";
import test from "node:test";

import { computeDeletedPurgeAt } from "@/lib/db/trashPurge";

test("computeDeletedPurgeAt adds 30 days", () => {
  const deletedAt = "2026-01-01T00:00:00.000Z";
  const purgeAt = computeDeletedPurgeAt(deletedAt);
  assert.equal(purgeAt, "2026-01-31T00:00:00.000Z");
});
