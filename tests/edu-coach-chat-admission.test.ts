import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEduCoachChatAdmission } from "@/lib/server/eduCoachChatAdmission";

const request = new Request("http://localhost/api/v1/edu/coach/chat", { headers: { host: "localhost" } });
const userBody = (prompt: string, extra: Record<string, unknown> = {}) => ({ prompt, ...extra });

function setup(overrides: Record<string, unknown> = {}) {
  let rateLimitCalls = 0;
  let providerCalls = 0;
  const events: unknown[] = [];
  const deps = {
    readCoachMode: () => "backend" as const,
    getRateLimitSubject: async () => "subject",
    createRateLimitClient: () => ({ rpc: async () => ({ data: 1, error: null }) }),
    checkRateLimit: async () => {
      rateLimitCalls += 1;
      return { ok: true as const };
    },
    recordOpsEvent: async (event: unknown) => {
      events.push(event);
    },
    ...overrides,
  };
  return { deps, calls: () => ({ rateLimitCalls, providerCalls, events }) };
}

async function admission(body: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const state = setup(overrides);
  const result = await evaluateEduCoachChatAdmission({ request, requestId: "req-coach", route: "/api/v1/edu/coach/chat", body }, state.deps);
  return { result, calls: state.calls() };
}

test("empty prompt is rejected before rate limiting", async () => {
  const { result, calls } = await admission(userBody(""));
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 400);
  assert.deepEqual(calls, { rateLimitCalls: 0, providerCalls: 0, events: [] });
});

test("1200 characters are accepted and 1201 are rejected", async () => {
  assert.equal((await admission(userBody("x".repeat(1200)))).result.kind, "proceed");
  const rejected = await admission(userBody("x".repeat(1201)));
  assert.equal(rejected.result.kind, "respond");
  assert.equal(rejected.result.status, 400);
  assert.equal(rejected.calls.rateLimitCalls, 0);
});

for (const mode of ["disabled", "guide", "template"] as const) {
  test(`${mode} mode bypasses rate limiting`, async () => {
    const { result, calls } = await admission(userBody("질문"), { readCoachMode: () => mode });
    assert.equal(result.kind, "local");
    assert.equal(result.kind === "local" && result.mode, mode);
    assert.equal(calls.rateLimitCalls, 0);
  });
}

test("remote allow preserves normalized identity", async () => {
  const { result, calls } = await admission(userBody("질문", { lessonId: "12", shareCode: " SHARE " }));
  assert.deepEqual(result, { kind: "proceed", prompt: "질문", lessonId: 12, shareCode: "SHARE" });
  assert.equal(calls.rateLimitCalls, 1);
});

test("remote denial returns Retry-After without provider admission", async () => {
  const { result, calls } = await admission(userBody("질문"), { checkRateLimit: async () => ({ ok: false as const, retryAfterSeconds: 17 }) });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 429);
  assert.equal(result.kind === "respond" && result.payload.code, "EDU_COACH_RATE_LIMITED");
  assert.deepEqual(result.kind === "respond" && result.extraHeaders, { "Retry-After": "17" });
});

test("rate-limit backend failure fails closed and records a safe event", async () => {
  const sentinel = "raw-rate-limit-error";
  const { result, calls } = await admission(userBody("질문"), {
    checkRateLimit: async () => { throw new Error(sentinel); },
  });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 503);
  assert.equal(result.kind === "respond" && result.payload.code, "EDU_COACH_RATE_LIMIT_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sentinel));
  assert.equal(calls.events.length, 1);
  assert.doesNotMatch(JSON.stringify(calls.events[0]), new RegExp(sentinel));
  assert.doesNotMatch(JSON.stringify(calls.events[0]), /shareCode|subject|credential|stack|error\.message/i);
});

test("ops logger rejection does not change the 503 result", async () => {
  const { result } = await admission(userBody("질문"), {
    checkRateLimit: async () => { throw new Error("backend"); },
    recordOpsEvent: async () => { throw new Error("ops"); },
  });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 503);
});
