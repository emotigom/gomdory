import assert from "node:assert/strict";
import test from "node:test";

import { MemoryRateLimitStore, enforceRateLimit } from "@/lib/security/rateLimit";

test("blocks when exceeding max", async () => {
  const store = new MemoryRateLimitStore();
  const base = { key: "rl:test", windowMs: 1_000, max: 1, store };
  const first = await enforceRateLimit(base);
  const second = await enforceRateLimit(base);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(typeof second.retryAfterSec, "number");
});

test("applies burst rules separately", async () => {
  const store = new MemoryRateLimitStore();
  const base = { key: "rl:burst", windowMs: 10_000, max: 5, burstMs: 2_000, burstMax: 1, store };

  const first = await enforceRateLimit(base);
  const second = await enforceRateLimit(base);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});
