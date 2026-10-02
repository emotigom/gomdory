import assert from "node:assert/strict";
import test from "node:test";

import { getOrCreateRequestId, withRequestContext } from "@/lib/api/server/requestContext";

test("getOrCreateRequestId uses client request header when available", () => {
  const headers = new Headers({ "x-request-id": "req-123", "x-client-request-id": "client-456" });
  const requestId = getOrCreateRequestId(headers);
  assert.equal(requestId, "client-456");
});

test("withRequestContext attaches request headers", async () => {
  const handler = withRequestContext(async () => new Response("ok"));
  const response = await handler(new Request("http://localhost/test"), undefined);

  const requestId = response.headers.get("x-request-id");
  const duration = response.headers.get("x-duration-ms");

  assert.ok(requestId);
  assert.ok(duration);
});

test("getOrCreateRequestId falls back to x-request-id", () => {
  const headers = new Headers({ "x-request-id": "req-789" });
  const requestId = getOrCreateRequestId(headers);
  assert.equal(requestId, "req-789");
});
