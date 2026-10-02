import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as opsLogPost } from "@/app/api/v1/ops/log/route";

test("ops log route masks PII and responds with requestId", async () => {
  const request = new NextRequest(
    new Request("http://localhost/api/v1/ops/log", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        "x-request-id": "test-req-1",
      },
      body: JSON.stringify({
        message: "contact me at test@example.com or 010-1234-5678",
        stack: "Error: stack\n    at file.js:1:1",
      }),
    }),
  );

  const response = await opsLogPost(request);
  const body = (await response.json()) as { ok?: boolean; requestId?: string; reasons?: string[] };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.requestId);
  assert.ok(response.headers.get("x-request-id"));
  assert.ok(body.reasons?.includes("pii_email"));
  assert.ok(body.reasons?.includes("pii_phone"));
});
