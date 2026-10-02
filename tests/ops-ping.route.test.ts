import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as pingGet } from "@/app/api/v1/ops/ping/route";
import { routes } from "@/lib/standards/routes";

test("ops ping responds ok with requestId header", async () => {
  const response = await pingGet(
    new NextRequest(new Request(new URL(routes.api.ops.ping(), "http://localhost"))),
    undefined,
  );
  const body = (await response.json()) as { ok?: boolean; requestId?: string };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.requestId);
  assert.ok(response.headers.get("x-request-id"));
});
