import assert from "node:assert/strict";
import test from "node:test";

import { postDecoratePlanWithDeps } from "@/lib/edu/lesson/serverDecoratePlanRouteHandler";

test("join-token student session reaches OpenAI fetch instead of 401", async () => {
  const previousDirectDisabled = process.env.EDU_OPENAI_DIRECT_DISABLED;
  const previousSafeMode = process.env.EDU_STUDENT_AI_SAFE_MODE;
  const previousDeterministicForced = process.env.EDU_DECORATE_FORCE_DETERMINISTIC;
  process.env.EDU_OPENAI_DIRECT_DISABLED = "0";
  process.env.EDU_STUDENT_AI_SAFE_MODE = "0";
  process.env.EDU_DECORATE_FORCE_DETERMINISTIC = "0";
  process.env.OPENAI_API_KEY = "test-key";
  let fetchCalled = false;

  try {
    const response = await postDecoratePlanWithDeps(
      new Request("http://localhost/api/v1/edu/decorate/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "배경 톤을 부드럽게", snapshotVersion: "snap-join-1" }),
      }),
      {
        createSupabaseServerClientFn: () =>
          ({
            auth: {
              getUser: async () => ({ data: { user: null } }),
            },
            from: () => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              upsert: async () => ({ error: null }),
            }),
          }) as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>,
        createSupabaseAdminClientFn: () =>
          ({
            from: () => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              upsert: async () => ({ error: null }),
            }),
          }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
        resolveJoinTokenFromRequestFn: () => "jt_test_token_123456",
        getEduJoinSessionFn: async () => ({ shareCode: "share-join-1" }),
        checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
        fetchFn: (async (input: RequestInfo | URL) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
          if (url.includes("https://api.openai.com/v1/responses")) {
            fetchCalled = true;
            return new Response(
              JSON.stringify({
                output_text: JSON.stringify({ version: 1, summary: "join token plan", ops: [] }),
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response("not found", { status: 404 });
        }) as typeof fetch,
      },
    );

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.provider, "server_llm");
    assert.equal(fetchCalled, true);
  } finally {
    if (previousDirectDisabled === undefined) delete process.env.EDU_OPENAI_DIRECT_DISABLED;
    else process.env.EDU_OPENAI_DIRECT_DISABLED = previousDirectDisabled;

    if (previousSafeMode === undefined) delete process.env.EDU_STUDENT_AI_SAFE_MODE;
    else process.env.EDU_STUDENT_AI_SAFE_MODE = previousSafeMode;

    if (previousDeterministicForced === undefined) delete process.env.EDU_DECORATE_FORCE_DETERMINISTIC;
    else process.env.EDU_DECORATE_FORCE_DETERMINISTIC = previousDeterministicForced;
  }
});
