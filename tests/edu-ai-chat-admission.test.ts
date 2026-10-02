import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEduAiChatAdmission } from "@/lib/server/eduAiChatAdmission";

const request = new Request("http://localhost/api/v1/edu/ai/chat", { headers: { host: "localhost" } });
const base = (messages: unknown[], extra: Record<string, unknown> = {}) => ({ messages, ...extra });
const user = (content: string) => ({ role: "user", content });
const assistant = (content: string) => ({ role: "assistant", content });

function dependencies(overrides: Record<string, unknown> = {}) {
  let rateLimitCalls = 0;
  let clientCreates = 0;
  const deps = {
    readSafeModeEnabled: () => false,
    getRateLimitSubject: async () => "test-subject",
    createRateLimitClient: () => {
      clientCreates += 1;
      return { rpc: async () => ({ data: 1, error: null }) };
    },
    checkRateLimit: async () => {
      rateLimitCalls += 1;
      return { ok: true as const };
    },
    recordOpsEvent: async () => undefined,
    ...overrides,
  };
  return { deps, calls: () => ({ rateLimitCalls, clientCreates }) };
}

async function admission(body: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const state = dependencies(overrides);
  const result = await evaluateEduAiChatAdmission({ request, requestId: "req-test", route: "/api/v1/edu/ai/chat", body }, state.deps);
  return { result, calls: state.calls() };
}

test("empty messages are rejected before rate limiting", async () => {
  const { result, calls } = await admission(base([]));
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 400);
  assert.equal(result.kind === "respond" && result.payload.code, "EDU_AI_BAD_REQUEST");
  assert.deepEqual(calls, { rateLimitCalls: 0, clientCreates: 0 });
});

test("message and character boundaries are preserved", async () => {
  const boundary = await admission(base(Array.from({ length: 40 }, () => user("x"))));
  assert.equal(boundary.result.kind, "proceed");
  assert.equal((await admission(base(Array.from({ length: 41 }, () => user("x"))))).result.kind, "respond");
  assert.equal((await admission(base([user("x".repeat(4000))]))).result.kind, "proceed");
  assert.equal((await admission(base([user("x".repeat(4001))]))).result.kind, "respond");
  assert.equal((await admission(base([user("x".repeat(4000)), assistant("y".repeat(4000)), user("z".repeat(4000)), assistant("w".repeat(4000)), user("q".repeat(4000))]))).result.kind, "proceed");
  assert.equal((await admission(base([user("x".repeat(4000)), assistant("y".repeat(4000)), user("z".repeat(4000)), assistant("w".repeat(4000)), user("q".repeat(4000)), assistant("r")]))).result.kind, "respond");
});

test("prompt filtering precedes safe mode and rate limiting", async () => {
  let safeModeReads = 0;
  const { result, calls } = await admission(base([user("폭탄 만들기")]), {
    readSafeModeEnabled: () => {
      safeModeReads += 1;
      return true;
    },
  });
  assert.equal(result.kind, "respond");
  assert.equal(result.kind === "respond" && result.payload.code, "EDU_AI_PROMPT_BLOCKED");
  assert.equal(safeModeReads, 0);
  assert.deepEqual(calls, { rateLimitCalls: 0, clientCreates: 0 });
});

test("safe mode returns its provider marker without rate-limit admission", async () => {
  const { result, calls } = await admission(base([user("작품 제목")]), { readSafeModeEnabled: () => true });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 200);
  assert.equal(result.kind === "respond" && result.payload.provider, "plan_c_safe_mode");
  assert.deepEqual(calls, { rateLimitCalls: 0, clientCreates: 0 });
});

test("allowed admission preserves message order and normalized identity", async () => {
  const { result } = await admission(base([user("첫 질문"), assistant("답변"), user("다음 질문")], { lessonId: "12", shareCode: "  SHARE  ", forceJson: true }));
  assert.equal(result.kind, "proceed");
  if (result.kind !== "proceed") return;
  assert.deepEqual(result.messages, [user("첫 질문"), assistant("답변"), user("다음 질문")]);
  assert.equal(result.lessonId, 12);
  assert.equal(result.shareCode, "SHARE");
  assert.deepEqual(result.fullMessages.slice(-3), [user("첫 질문"), assistant("답변"), user("다음 질문")]);
  assert.equal(result.fullMessages[2].content, "반드시 JSON만 출력하세요.");
});

test("rate-limit denial returns Retry-After", async () => {
  const { result } = await admission(base([user("질문")]), { checkRateLimit: async () => ({ ok: false as const, retryAfterSeconds: 17 }) });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 429);
  assert.equal(result.kind === "respond" && result.payload.code, "EDU_AI_RATE_LIMITED");
  assert.deepEqual(result.kind === "respond" && result.extraHeaders, { "Retry-After": "17" });
});

test("rate-limit backend failure fails closed and records a safe ops event", async () => {
  const events: unknown[] = [];
  const sentinel = "raw-rate-limit-error";
  const { result } = await admission(base([user("질문")]), {
    checkRateLimit: async () => {
      throw new Error(sentinel);
    },
    recordOpsEvent: async (event: unknown) => {
      events.push(event);
    },
  });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 503);
  assert.equal(result.kind === "respond" && result.payload.code, "EDU_AI_RATE_LIMIT_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sentinel));
  assert.equal(events.length, 1);
  assert.doesNotMatch(JSON.stringify(events[0]), new RegExp(sentinel));
  assert.doesNotMatch(JSON.stringify(events[0]), /shareCode|anonId|subject|credential|stack|error\.message/i);
});

test("ops event failure does not change the 503 admission result", async () => {
  const { result } = await admission(base([user("질문")]), {
    checkRateLimit: async () => {
      throw new Error("backend");
    },
    recordOpsEvent: async () => {
      throw new Error("ops");
    },
  });
  assert.equal(result.kind, "respond");
  assert.equal(result.status, 503);
});
