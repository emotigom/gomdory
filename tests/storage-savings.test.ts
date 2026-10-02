import assert from "node:assert/strict";
import test from "node:test";

import { computeOptimizedBytesSaved } from "@/lib/storage/usage";

test("computeOptimizedBytesSaved sums optimized rows only", () => {
  const total = computeOptimizedBytesSaved([
    { originalBytes: 4000, optimizedBytes: 1000, optimized: true },
    { originalBytes: 2000, optimizedBytes: 2000, optimized: true },
    { originalBytes: 3000, optimizedBytes: 1000, optimized: false },
    { originalBytes: 500, optimizedBytes: 250, optimized: null },
  ]);

  assert.equal(total, 3000);
});
