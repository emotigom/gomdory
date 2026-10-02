import assert from "node:assert/strict";
import test from "node:test";

import { normalizeShareCode } from "@/lib/student/shareCode";
import { POST } from "@/app/s/enter/route";

test("join-one-step normalizes code for direct /s/<code> join", () => {
  const normalized = normalizeShareCode(" EB2V8Q ");

  assert.equal(normalized, "eb2v8q");
  assert.equal(`/s/${normalized}`, "/s/eb2v8q");
});

test("join-one-step ignores empty codes", () => {
  const normalized = normalizeShareCode("   ");

  assert.equal(normalized, "");
});

test("join-one-step POST /s/enter redirects to /s with invalid_code when board lookup fails", async () => {
  const form = new FormData();
  form.set("code", " EB2V8Q ");
  form.set("name", "  홍길동 ");

  const request = new Request("http://localhost/s/enter", {
    method: "POST",
    body: form,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (/example\.supabase\.co/.test(url)) {
      throw new Error(`stubbed_supabase_fetch:${url}`);
    }
    return originalFetch(input);
  };

  try {
    const response = await POST(request);
    const location = response.headers.get("location");
    const cookie = response.headers.get("set-cookie");
    const joinHeader = response.headers.get("x-gomdori-join-enter");
    const joinCode = response.headers.get("x-gomdori-join-code");

    assert.equal(response.status, 303);
    assert.ok(location);
    const redirectUrl = new URL(location);
    assert.equal(redirectUrl.pathname, "/s");
    assert.equal(redirectUrl.searchParams.get("error"), "invalid_code");
    assert.equal(redirectUrl.searchParams.get("code"), "eb2v8q");
    assert.equal(cookie, null);
    assert.equal(joinHeader, "1");
    assert.equal(joinCode, "eb2v8q");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
