import assert from "node:assert/strict";
import test from "node:test";

import { requestServerDecoratePlan } from "@/lib/edu/lesson/serverDecoratePlanClient";

test("requestServerDecoratePlan appends jt query and same-origin credentials", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledCredentials: RequestCredentials | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calledUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calledCredentials = init?.credentials;
    return new Response(
      JSON.stringify({ ok: true, provider: "server_llm", plan: { version: 1, summary: "ok", ops: [] } }),
      { status: 200, headers: { "x-request-id": "req-1", "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await requestServerDecoratePlan({
      prompt: "부드럽게",
      snapshotVersion: "snap-1",
      joinToken: "jt_test_token_123456",
    });

    assert.equal(result.ok, true);
    assert.match(calledUrl, /\/api\/v1\/edu\/decorate\/plan\?jt=jt_test_token_123456$/);
    assert.equal(calledCredentials, "same-origin");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
