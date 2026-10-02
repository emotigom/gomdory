import assert from "node:assert/strict";
import test from "node:test";

import { postDecoratePlanWithDeps } from "@/lib/edu/lesson/serverDecoratePlanRouteHandler";

const originalEnv = { ...process.env };

const createSupabaseStub = (userId: string | null = "user-1") =>
  ({
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
  }) as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>;

const createSupabaseAdminStub = () =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
  }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>;

test.afterEach(() => {
  process.env = { ...originalEnv };
});

const enableExplicitServerProviderMode = () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.EDU_STUDENT_AI_SAFE_MODE = "0";
  process.env.EDU_DECORATE_FORCE_DETERMINISTIC = "0";
  process.env.EDU_OPENAI_DIRECT_DISABLED = "0";
};

test("decorate plan route validates prompt/snapshotVersion", async () => {
  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      body: JSON.stringify({ prompt: "", snapshotVersion: "" }),
    }),
    {
      createSupabaseServerClientFn: createSupabaseStub,
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
    },
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "EDU_DECORATE_BAD_REQUEST");
});

test("decorate plan route fails fast when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY;

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      body: JSON.stringify({ prompt: "배경을 꾸며줘", snapshotVersion: "snap-1" }),
    }),
    {
      createSupabaseServerClientFn: createSupabaseStub,
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
    },
  );

  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "EDU_DECORATE_PROVIDER_MISSING");
});

test("admin client creation failure fails closed before provider path", async () => {
  enableExplicitServerProviderMode();
  let fetchCalled = false;

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req-test" },
      body: JSON.stringify({ prompt: "파스텔톤으로", snapshotVersion: "snap-admin-fail" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-42"),
      createSupabaseAdminClientFn: () => {
        throw new Error("admin broken");
      },
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
      fetchFn: (async () => {
        fetchCalled = true;
        return new Response(
          JSON.stringify({ output_text: JSON.stringify({ version: 1, summary: "ok", ops: [] }) }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
  );

  assert.equal(response.status, 503);
  assert.equal(fetchCalled, false);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "EDU_DECORATE_RATE_LIMIT_UNAVAILABLE");
  assert.equal(payload.requestId, "req-test");
});

test("rate-limit infra failure fails closed before provider path", async () => {
  enableExplicitServerProviderMode();
  let fetchCalled = false;

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req-test" },
      body: JSON.stringify({ prompt: "차분한 톤", snapshotVersion: "snap-ratelimit-fail" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-1"),
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => {
        throw new Error("rate limit table missing");
      },
      fetchFn: (async () => {
        fetchCalled = true;
        return new Response(
          JSON.stringify({ output_text: JSON.stringify({ version: 1, summary: "ok", ops: [] }) }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
  );

  assert.equal(response.status, 503);
  assert.equal(fetchCalled, false);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "EDU_DECORATE_RATE_LIMIT_UNAVAILABLE");
  assert.equal(payload.requestId, "req-test");
});

test("cache write failure does not override OpenAI success 200", async () => {
  enableExplicitServerProviderMode();

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "조금 따뜻한 느낌", snapshotVersion: "snap-cache-write" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-1"),
      createSupabaseAdminClientFn: () =>
        ({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            upsert: async () => ({ error: { message: "write denied" } }),
          }),
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
      fetchFn: (async () =>
        new Response(JSON.stringify({ output_text: JSON.stringify({ version: 1, summary: "ok", ops: [] }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, "server_llm");
});

test("join-token lookup exception results in controlled unauthorized response", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let fetchCalled = false;

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan?jt=jt_test_token_123456", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "차분하게", snapshotVersion: "snap-join-fail" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub(null),
      resolveJoinTokenFromRequestFn: () => "jt_test_token_123456",
      getEduJoinSessionFn: async () => {
        throw new Error("join lookup crashed");
      },
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
      fetchFn: (async () => {
        fetchCalled = true;
        return new Response("never", { status: 500 });
      }) as typeof fetch,
    },
  );

  assert.equal(response.status, 401);
  assert.equal(fetchCalled, false);
});


test("legacy WebLLM env fallback does not affect decorate provider path", async () => {
  enableExplicitServerProviderMode();
  process.env.WEBLLM_ENABLED = "0";
  process.env.NEXT_PUBLIC_WEBLLM_MODEL_ID = "legacy-model";

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "선명한 색상", snapshotVersion: "snap-legacy-irrelevant" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-1"),
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
      fetchFn: (async () =>
        new Response(JSON.stringify({ output_text: JSON.stringify({ version: 1, summary: "ok", ops: [] }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, "server_llm");
});

test("responses payload uses text.format json_schema at top-level and deterministic fallback stays schema-valid", async () => {
  enableExplicitServerProviderMode();
  let capturedBody: Record<string, unknown> | null = null;

  const fallbackResponse = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "javascript:alert(1)", snapshotVersion: "snap-fallback" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-1"),
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
    },
  );

  const fallbackPayload = await fallbackResponse.json();
  assert.equal(fallbackResponse.status, 200);
  assert.equal(fallbackPayload.ok, true);
  assert.equal(fallbackPayload.provider, "deterministic_safe");
  assert.equal(fallbackPayload.plan.version, 1);

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "파스텔 배경", snapshotVersion: "snap-format" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-1"),
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
      fetchFn: (async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(JSON.stringify({ output_text: JSON.stringify({ version: 1, summary: "ok", ops: [] }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    },
  );

  assert.equal(response.status, 200);
  assert.ok(capturedBody);
  assert.equal((capturedBody?.text as { format?: { type?: string } })?.format?.type, "json_schema");
  assert.equal((capturedBody?.text as { format?: { name?: string } })?.format?.name, "decorate_plan_v1");
  assert.equal(typeof (capturedBody?.text as { format?: { schema?: unknown } })?.format?.schema, "object");
});

test("non-2xx openai response is classified with reason and mapped status", async () => {
  enableExplicitServerProviderMode();

  const response = await postDecoratePlanWithDeps(
    new Request("http://localhost/api/v1/edu/decorate/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "차분하게", snapshotVersion: "snap-openai-400" }),
    }),
    {
      createSupabaseServerClientFn: () => createSupabaseStub("user-1"),
      createSupabaseAdminClientFn: createSupabaseAdminStub,
      checkAndIncrementFn: async () => ({ allowed: true, retryAfter: 0 }),
      fetchFn: (async () =>
        new Response(JSON.stringify({ error: { type: "invalid_request_error" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 502);
  assert.equal(payload.ok, false);
  assert.equal(payload.reason, "openai_bad_request");
  assert.equal(payload.code, "EDU_DECORATE_PROVIDER_BAD_REQUEST");
  assert.equal(payload.upstreamStatus, 400);
});
