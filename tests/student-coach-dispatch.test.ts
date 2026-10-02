import assert from "node:assert/strict";
import test from "node:test";

import { resolveStudentCoachDispatchDecision } from "@/lib/edu/lesson/studentCoachExecution";

const createRequestId = () => "req_student_coach_dispatch";

test("enter submit starts a coach request with a stable request id", () => {
  const decision = resolveStudentCoachDispatchDecision({
    source: "enter",
    inputValue: "도입 문장을 더 또렷하게 바꿔줘",
    isGeneratingFiles: false,
    coachUnavailable: false,
    isOpsModeLocked: false,
    createRequestId,
  });

  assert.deepEqual(decision, {
    kind: "start",
    mode: "start",
    source: "enter",
    prompt: "도입 문장을 더 또렷하게 바꿔줘",
    requestId: "req_student_coach_dispatch",
    requestIdOwnership: "new",
  });
});

test("retry source stays observable as retry mode", () => {
  const decision = resolveStudentCoachDispatchDecision({
    source: "fallback_retry",
    inputValue: "방금 요청 다시 시도해줘",
    isGeneratingFiles: false,
    coachUnavailable: false,
    isOpsModeLocked: false,
    createRequestId,
  });

  assert.equal(decision.kind, "start");
  assert.equal(decision.mode, "retry");
  assert.equal(decision.requestId, "req_student_coach_dispatch");
  assert.equal(decision.requestIdOwnership, "new");
});

test("empty prompt is blocked before coach dispatch starts", () => {
  const decision = resolveStudentCoachDispatchDecision({
    source: "submit",
    inputValue: "   ",
    isGeneratingFiles: false,
    coachUnavailable: false,
    isOpsModeLocked: false,
    createRequestId,
  });

  assert.equal(decision.kind, "blocked");
  assert.equal(decision.reason, "empty_prompt");
  assert.equal(decision.reasonCategory, "input");
  assert.equal(decision.requestId, null);
  assert.equal(decision.requestIdOwnership, "none");
});

test("generation in progress blocks duplicate coach dispatch", () => {
  const decision = resolveStudentCoachDispatchDecision({
    source: "send_button",
    inputValue: "버튼 색을 더 차분하게 설명해줘",
    isGeneratingFiles: true,
    coachUnavailable: false,
    isOpsModeLocked: false,
    createRequestId,
  });

  assert.equal(decision.kind, "blocked");
  assert.equal(decision.reason, "generation_running");
  assert.equal(decision.reasonCategory, "concurrency");
});

test("ops lock remains a stable blocked reason for telemetry", () => {
  const decision = resolveStudentCoachDispatchDecision({
    source: "submit",
    inputValue: "소개 문구를 추천해줘",
    isGeneratingFiles: false,
    coachUnavailable: false,
    isOpsModeLocked: true,
    createRequestId,
  });

  assert.equal(decision.kind, "blocked");
  assert.equal(decision.reason, "ops_locked");
  assert.equal(decision.reasonCategory, "policy");
});
