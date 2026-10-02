import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { normalizeOperationalRouteResponse } from "@/lib/api/server/operationalRoute";
import { withOps } from "@/lib/ops/withOps";

test("normalizeOperationalRouteResponse attaches request headers and requestId for object payloads", async () => {
  const response = normalizeOperationalRouteResponse(
    { ok: true, feature: "ops" },
    { requestId: "req-operational", startedAt: Date.now() - 5 },
  );
  const body = (await response.json()) as { ok?: boolean; feature?: string; requestId?: string };

  assert.equal(body.ok, true);
  assert.equal(body.feature, "ops");
  assert.equal(body.requestId, "req-operational");
  assert.equal(response.headers.get("x-request-id"), "req-operational");
  assert.ok(response.headers.get("x-op-duration-ms"));
});

test("withOps attaches headers and requestId on success", async () => {
  const handler = withOps(async (_request, _ctx, ops) => ({ ok: true, requestId: ops.requestId }));

  const response = await handler(new NextRequest(new Request("http://localhost/api/test")), undefined);
  const body = (await response.json()) as { ok?: boolean; requestId?: string };

  assert.equal(body.ok, true);
  assert.ok(body.requestId);
  assert.ok(response.headers.get("x-request-id"));
  assert.ok(response.headers.get("x-op-duration-ms"));
});

test("withOps returns standardized error payload when handler throws", async () => {
  const handler = withOps(async () => {
    throw new Error("boom");
  });

  const response = await handler(new NextRequest(new Request("http://localhost/api/test")), undefined);
  const body = (await response.json()) as { ok?: boolean; code?: string; requestId?: string };

  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.equal(body.code, "unknown");
  assert.ok(body.requestId);
  assert.ok(response.headers.get("x-request-id"));
});
