import assert from "node:assert/strict";
import test from "node:test";

import { checkRateLimit } from "@/lib/safety/rateLimit";

function createRateLimitDb() {
  const buckets = new Map<string, number>();
  return {
    rpc: async (_fn: string, params: Record<string, unknown>) => {
      const key = `${params.p_key}:${params.p_window_start}`;
      const next = (buckets.get(key) ?? 0) + 1;
      buckets.set(key, next);
      return { data: next, error: null };
    },
  };
}

test("checkRateLimit returns retryAfter when over limit", async () => {
  const db = createRateLimitDb();
  const now = 1_700_000_000_000;

  const first = await checkRateLimit(db, { key: "k1", windowSeconds: 60, limit: 1, now });
  const second = await checkRateLimit(db, { key: "k1", windowSeconds: 60, limit: 1, now });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.ok(second.retryAfterSeconds >= 1);
  }
});
