import test from "node:test";
import assert from "node:assert/strict";

import { emitEduClassJoinSaveFailure } from "../lib/edu/classJoinFailure";

test("edu class join save failure keeps the response safe and preserves request id", async () => {
  const sentinel = "private-storage-database-secret-sentinel";
  const events: unknown[] = [];

  const response = emitEduClassJoinSaveFailure({
    requestId: "req-join-123",
    route: "/api/v1/edu/class/join",
    recordEvent: async (event) => {
      events.push(event);
      throw new Error(sentinel);
    },
  });

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("x-request-id"), "req-join-123");
  assert.equal(response.headers.get("x-gom-request-id"), "req-join-123");

  const body = await response.json();
  const serialized = JSON.stringify(body);
  assert.deepEqual(body, {
    ok: false,
    requestId: "req-join-123",
    error: {
      code: "JOIN_FAILED",
      message: "참여 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    },
  });
  assert.equal(serialized.includes(sentinel), false);
  assert.equal(events.length, 1);
  assert.equal(JSON.stringify(events[0]).includes(sentinel), false);
  assert.equal(JSON.stringify(events[0]).includes("shareCode"), false);

  await new Promise((resolve) => setImmediate(resolve));
});
