import assert from "node:assert/strict";
import test from "node:test";

import { enforceRateLimit, MemoryRateLimitStore } from "@/lib/security/rateLimit";

test("rate limiter blocks beyond limit with retryAfter", async () => {
  const store = new MemoryRateLimitStore();
  const now = 1_700_000_000_000;

  const first = await enforceRateLimit({
    key: "ip:code:student_actions",
    windowMs: 10_000,
    max: 1,
    store,
    now,
  });

  const second = await enforceRateLimit({
    key: "ip:code:student_actions",
    windowMs: 10_000,
    max: 1,
    store,
    now: now + 1,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(second.retryAfterSec, 10);
});
