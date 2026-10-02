import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as liveGet } from "@/app/api/v1/s/[code]/live/route";

test("student live endpoint is disabled and returns gone payload", async () => {
  const request = new NextRequest(new Request("http://localhost/api/v1/s/abc234/live"));

  const response = await liveGet(request);

  const payload = await response.json();
  assert.equal(response.status, 410);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "gone");
});
