import assert from "node:assert/strict";
import test from "node:test";

import { createRafCoalescer } from "@/lib/ui/rafCoalescer";

test("createRafCoalescer coalesces duplicate schedules in the same frame", () => {
  const queued: Array<() => void> = [];
  let callbackRuns = 0;
  let nextHandle = 1;

  const coalescer = createRafCoalescer(
    () => {
      callbackRuns += 1;
    },
    (cb) => {
      queued.push(() => cb(0));
      return nextHandle++;
    },
  );

  assert.equal(coalescer.schedule(), true);
  assert.equal(coalescer.schedule(), false);
  assert.equal(queued.length, 1);

  queued[0]?.();
  assert.equal(callbackRuns, 1);

  assert.equal(coalescer.schedule(), true);
  assert.equal(queued.length, 2);
});
