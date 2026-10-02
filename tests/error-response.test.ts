import assert from "node:assert/strict";
import test from "node:test";

import { buildError } from "@/lib/server/errorResponse";

test("buildError shapes standardized worker error responses", async () => {
  const response = buildError({
    code: "WORKER_INTERNAL_ERROR",
    message: "일시적인 오류...",
    requestId: "req-123",
    retryable: true,
    status: 500,
  });

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("x-request-id"), "req-123");
  assert.equal(response.headers.get("x-gom-request-id"), "req-123");

  const payload = await response.json();
  assert.deepEqual(payload, {
    ok: false,
    code: "WORKER_INTERNAL_ERROR",
    message: "일시적인 오류...",
    requestId: "req-123",
    retryable: true,
  });
});
