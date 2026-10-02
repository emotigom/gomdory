import assert from "node:assert/strict";
import test from "node:test";

import { EDU_PROVIDER_RESULT, EDU_PROVIDER_TARGET } from "@/lib/edu/providerBoundary";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { createEduAiChatResponseHandlers } from "@/lib/server/eduAiChatResponsePolicy";

type BackendFailureInput = Parameters<ReturnType<typeof createEduAiChatResponseHandlers>["onBackendFailure"]>[0];

const context = { requestId: "request-123", route: "/api/v1/edu/ai/chat" };

function backendFailure(): BackendFailureInput["backend"] {
  return {
    ok: false,
    status: 503,
    body: { sentinel: "internal-provider-secret-sentinel" },
    diagnostics: {
      backendConfigured: true,
      backendStatus: 503,
      backendRequestId: "backend-request-id",
      mappedReason: "openai_upstream_5xx",
      timeoutHit: false,
      providerAttempted: EDU_PROVIDER_TARGET.backendProxy,
      providerResult: EDU_PROVIDER_RESULT.failed,
      providerStatusCategory: "provider_upstream_error",
    },
  };
}

test("backend failure preserves the response contract and records safe diagnostics", async () => {
  const events: Array<Parameters<typeof recordOpsEvent>[0]> = [];
  let options: { sampleRate?: number; hardLimitPerMinute?: number } | undefined;
  const handlers = createEduAiChatResponseHandlers({
    ...context,
    dependencies: {
      recordOpsEvent: async (event, eventOptions) => {
        events.push(event);
        options = eventOptions;
      },
    },
  });

  const draft = handlers.onBackendFailure({ backend: backendFailure() });
  await Promise.resolve();

  assert.equal(draft.status, 503);
  assert.equal(draft.payload.ok, false);
  assert.equal(draft.payload.code, "EDU_AI_REMOTE_FAILED");
  assert.equal(draft.payload.usedFallback, false);
  assert.equal(draft.payload.message, "AI 응답 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(draft.payload.reason, "openai_upstream_5xx");
  assert.equal(draft.payload.providerAttempted, EDU_PROVIDER_TARGET.backendProxy);
  assert.equal(draft.payload.backendStatus, 503);
  assert.equal(draft.payload.backendRequestId, "backend-request-id");
  assert.doesNotMatch(JSON.stringify(draft.payload), /internal-provider-secret-sentinel/);
  assert.equal(events.length, 1);
  assert.equal(events[0].request_id, "request-123");
  assert.equal(events[0].status, 503);
  assert.deepEqual(events[0].meta, {
    stage: "edu_ai_remote",
    provider: EDU_PROVIDER_TARGET.backendProxy,
    result: EDU_PROVIDER_RESULT.failed,
    mappedReason: "openai_upstream_5xx",
  });
  assert.deepEqual(options, { sampleRate: 1, hardLimitPerMinute: 120 });
});

test("ops logger rejection is isolated from the synchronous backend failure draft", () => {
  const handlers = createEduAiChatResponseHandlers({
    ...context,
    dependencies: {
      recordOpsEvent: async () => {
        throw new Error("ops logger failure");
      },
    },
  });

  const draft = handlers.onBackendFailure({ backend: backendFailure() });
  assert.equal(draft.status, 503);
  assert.equal(draft.payload.code, "EDU_AI_REMOTE_FAILED");
});

test("answer missing returns the fixed 502 response without an ops event", () => {
  let eventCount = 0;
  const handlers = createEduAiChatResponseHandlers({
    ...context,
    dependencies: {
      recordOpsEvent: async () => {
        eventCount += 1;
      },
    },
  });

  const draft = handlers.onAnswerMissing({ backend: backendFailure() });
  assert.equal(draft.status, 502);
  assert.deepEqual(draft.payload, {
    ok: false,
    code: "EDU_AI_REMOTE_FAILED",
    reason: "unknown",
    message: "AI 응답을 읽지 못했어요.",
  });
  assert.equal(eventCount, 0);
});

test("success returns answer and message", () => {
  const handlers = createEduAiChatResponseHandlers({
    ...context,
    dependencies: {
      recordOpsEvent: async () => undefined,
    },
  });
  const draft = handlers.onSuccess({ backend: backendFailure(), answer: "테스트 답변" });

  assert.equal(draft.status, 200);
  assert.deepEqual(draft.payload, { ok: true, answer: "테스트 답변", message: "테스트 답변" });
});
