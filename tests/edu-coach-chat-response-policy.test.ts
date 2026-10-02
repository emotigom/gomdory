import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { EDU_PROVIDER_RESULT, EDU_PROVIDER_TARGET } from "@/lib/edu/providerBoundary";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { createEduCoachChatResponseHandlers } from "@/lib/server/eduCoachChatResponsePolicy";

type BackendFailureInput = Parameters<ReturnType<typeof createEduCoachChatResponseHandlers>["onBackendFailure"]>[0];

const context = { requestId: "request-coach-123", route: "/api/v1/edu/coach/chat" };

function backendFailure(): BackendFailureInput["backend"] {
  return {
    ok: false,
    status: 503,
    body: { sentinel: "coach-provider-secret-sentinel" },
    diagnostics: {
      backendConfigured: true,
      backendStatus: 503,
      backendRequestId: "coach-backend-request-id",
      mappedReason: "openai_upstream_5xx",
      timeoutHit: false,
      providerAttempted: EDU_PROVIDER_TARGET.backendProxy,
      providerResult: EDU_PROVIDER_RESULT.failed,
      providerStatusCategory: "provider_upstream_error",
    },
  };
}

test("backend failure preserves the coach response contract and records safe diagnostics", async () => {
  const events: Array<Parameters<typeof recordOpsEvent>[0]> = [];
  let options: { sampleRate?: number; hardLimitPerMinute?: number } | undefined;
  const handlers = createEduCoachChatResponseHandlers({
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
  assert.equal(draft.payload.usedFallback, false);
  assert.equal(draft.payload.reason, "openai_upstream_5xx");
  assert.equal(draft.payload.providerAttempted, EDU_PROVIDER_TARGET.backendProxy);
  assert.equal(draft.payload.backendStatus, 503);
  assert.equal(draft.payload.backendRequestId, "coach-backend-request-id");
  assert.doesNotMatch(JSON.stringify(draft.payload), /coach-provider-secret-sentinel/);
  assert.equal(events.length, 1);
  assert.equal(events[0].request_id, context.requestId);
  assert.equal(events[0].route, context.route);
  assert.equal(events[0].status, 503);
  assert.deepEqual(events[0].meta, {
    stage: "edu_coach_remote",
    provider: EDU_PROVIDER_TARGET.backendProxy,
    result: EDU_PROVIDER_RESULT.failed,
    mappedReason: "openai_upstream_5xx",
  });
  assert.deepEqual(options, { sampleRate: 1, hardLimitPerMinute: 120 });
  assert.doesNotMatch(JSON.stringify(events[0]), /coach-provider-secret-sentinel|body|authorization|token|prompt|shareCode|lessonId/i);
});

test("ops logger rejection is isolated from the backend failure draft", async () => {
  const handlers = createEduCoachChatResponseHandlers({
    ...context,
    dependencies: {
      recordOpsEvent: async () => {
        throw new Error("ops logger failure");
      },
    },
  });

  const draft = handlers.onBackendFailure({ backend: backendFailure() });
  await Promise.resolve();
  assert.equal(draft.status, 503);
  assert.equal(draft.payload.reason, "openai_upstream_5xx");
});

test("answer missing returns the fixed 502 coach response without an ops event", () => {
  let eventCount = 0;
  const handlers = createEduCoachChatResponseHandlers({
    ...context,
    dependencies: { recordOpsEvent: async () => { eventCount += 1; } },
  });

  const draft = handlers.onAnswerMissing({ backend: backendFailure() });
  assert.equal(draft.status, 502);
  assert.deepEqual(draft.payload, { ok: false, reason: "unknown", message: "응답을 읽지 못했어요." });
  assert.equal(eventCount, 0);
  assert.equal("code" in draft.payload, false);
});

test("success returns the coach answer and backend markers without a message", () => {
  let eventCount = 0;
  const handlers = createEduCoachChatResponseHandlers({
    ...context,
    dependencies: { recordOpsEvent: async () => { eventCount += 1; } },
  });

  const draft = handlers.onSuccess({ backend: backendFailure(), answer: "코치 테스트 답변" });
  assert.equal(draft.status, 200);
  assert.deepEqual(draft.payload, {
    ok: true,
    answer: "코치 테스트 답변",
    provider: EDU_PROVIDER_TARGET.backendProxy,
    remoteTargetKind: EDU_PROVIDER_TARGET.backendProxy,
  });
  assert.equal(eventCount, 0);
  assert.equal("message" in draft.payload, false);
});

test("coach route delegates remote response decisions to the dedicated policy", () => {
  const route = fs.readFileSync("app/api/v1/edu/coach/chat/route.ts", "utf8");
  assert.match(route, /createEduCoachChatResponseHandlers/);
  assert.match(route, /createEduCoachChatResponseHandlers\(\{ requestId, route \}\)/);
  assert.match(route, /handlers: responseHandlers/);
  assert.doesNotMatch(route, /onBackendFailure:/);
  assert.doesNotMatch(route, /buildEduAiStudentBackendFailureEnvelope/);
  assert.doesNotMatch(route, /recordOpsEvent/);
});
