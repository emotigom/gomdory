import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as studentRequestGet, POST as studentRequestPost } from "@/app/api/v1/s/[code]/requests/route";

test("student requests endpoint is disabled for GET", async () => {
  const request = new NextRequest(new Request("http://localhost/api/v1/s/abc234/requests"));
  const response = await studentRequestGet(request);
  const payload = await response.json();

  assert.equal(response.status, 410);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "gone");
});

test("student requests endpoint is disabled for POST", async () => {
  const request = new NextRequest(
    new Request("http://localhost/api/v1/s/abc234/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "req-1", text: "질문" }),
    }),
  );

  const response = await studentRequestPost(request);
  const payload = await response.json();

  assert.equal(response.status, 410);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "gone");
});
