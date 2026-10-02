import assert from "node:assert/strict";
import test from "node:test";

import { resolveStudentDecorateDispatchDecision } from "@/lib/edu/lesson/studentDecorateExecution";

const createRequestId = () => "req_student_dispatch";

test("failed state can start a new student decorate request", () => {
  const decision = resolveStudentDecorateDispatchDecision({
    source: "cta",
    uiState: "failed",
    ctaMode: "start",
    ctaDisabled: false,
    inputValue: "버튼을 더 선명하게 해줘",
    shareCode: "demo-share",
    isTeacherMode: false,
    createRequestId,
  });

  assert.deepEqual(decision, {
    kind: "start",
    mode: "start",
    state: "failed",
    disabled: false,
    source: "cta",
    prompt: "버튼을 더 선명하게 해줘",
    requestId: "req_student_dispatch",
    requestIdOwnership: "new",
  });
});

test("ready state routes CTA to apply using pending preview request id", () => {
  const decision = resolveStudentDecorateDispatchDecision({
    source: "enter",
    uiState: "ready",
    ctaMode: "apply",
    ctaDisabled: false,
    inputValue: "",
    shareCode: "demo-share",
    isTeacherMode: false,
    createRequestId,
    pendingRequestId: "req_pending_preview",
  });

  assert.deepEqual(decision, {
    kind: "apply",
    mode: "apply",
    state: "ready",
    disabled: false,
    source: "enter",
    prompt: "",
    requestId: "req_pending_preview",
    requestIdOwnership: "existing",
  });
});

test("empty prompt remains blocked before dispatch starts", () => {
  const decision = resolveStudentDecorateDispatchDecision({
    source: "send",
    uiState: "idle",
    ctaMode: "start",
    ctaDisabled: true,
    inputValue: "   ",
    shareCode: "demo-share",
    isTeacherMode: false,
    createRequestId,
  });

  assert.equal(decision.kind, "blocked");
  assert.equal(decision.reason, "empty_prompt");
  assert.equal(decision.reasonCategory, "input");
  assert.equal(decision.requestId, null);
  assert.equal(decision.requestIdOwnership, "none");
});

test("missing share code is blocked with a stable reason", () => {
  const decision = resolveStudentDecorateDispatchDecision({
    source: "cta",
    uiState: "idle",
    ctaMode: "start",
    ctaDisabled: false,
    inputValue: "배경을 더 밝게 해줘",
    shareCode: null,
    isTeacherMode: false,
    createRequestId,
  });

  assert.equal(decision.kind, "blocked");
  assert.equal(decision.reason, "missing_share_code");
  assert.equal(decision.reasonCategory, "availability");
});

test("blocked apply keeps preview request ownership for telemetry", () => {
  const decision = resolveStudentDecorateDispatchDecision({
    source: "cta",
    uiState: "sending",
    ctaMode: "apply",
    ctaDisabled: true,
    inputValue: "버튼을 더 선명하게 해줘",
    shareCode: "demo-share",
    isTeacherMode: false,
    createRequestId,
    pendingRequestId: "req_existing_preview",
  });

  assert.equal(decision.kind, "blocked");
  assert.equal(decision.requestId, "req_existing_preview");
  assert.equal(decision.requestIdOwnership, "existing");
  assert.equal(decision.reasonCategory, "state");
});
