import assert from "node:assert/strict";
import test from "node:test";
import { runBatchesWithConcurrency } from "@/lib/student-records/batchRunner";

test("runner waits for every success and rejection with max two in flight", async () => {
  let active = 0; let maximum = 0; const completed: number[] = [];
  const results = await runBatchesWithConcurrency([1, 2, 3, 4, 5], async (batch) => { active += 1; maximum = Math.max(maximum, active); await new Promise((resolve) => setTimeout(resolve, batch === 2 ? 1 : 3)); active -= 1; completed.push(batch); if (batch === 2) throw new Error("private provider output"); }, 2);
  assert.equal(maximum, 2); assert.equal(completed.length, 5); assert.equal(results.length, 5);
  assert.deepEqual(results.find((result) => result.batch === 2), { batch: 2, ok: false, code: "BATCH_FAILED" });
  assert.equal(results.filter((result) => result.ok).length, 4);
});
