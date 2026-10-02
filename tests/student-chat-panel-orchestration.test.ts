import assert from "node:assert/strict";
import test from "node:test";

import {
  createStudentCoachActionPlan,
  createStudentDecorateActionPlan,
} from "@/lib/edu/lesson/studentChatPanelOrchestration";

test("student decorate action plan keeps telemetry and apply effect aligned", () => {
  const plan = createStudentDecorateActionPlan({
    source: "cta",
    uiState: "ready",
    ctaMode: "apply",
    ctaDisabled: false,
    inputValue: "",
    shareCode: "demo-share",
    isTeacherMode: false,
    createRequestId: () => "req_unused",
    pendingRequestId: "req_pending_preview",
  });

  assert.equal(plan.effect.kind, "apply");
  assert.equal(plan.decision.kind, "apply");
  assert.deepEqual(
    plan.telemetryEvents.map((event) => event.type),
    ["decorate_submit_received", "student_decorate_cta_clicked"],
  );
  assert.equal(plan.telemetryEvents[0]?.requestId, "req_pending_preview");
  assert.equal(plan.telemetryEvents[1]?.extra.requestIdOwnership, "existing");
});

test("student decorate blocked plan preserves blocked reason telemetry", () => {
  const plan = createStudentDecorateActionPlan({
    source: "send",
    uiState: "idle",
    ctaMode: "start",
    ctaDisabled: true,
    inputValue: "   ",
    shareCode: "demo-share",
    isTeacherMode: false,
    createRequestId: () => "req_unused",
  });

  assert.equal(plan.effect.kind, "blocked");
  assert.equal(plan.decision.kind, "blocked");
  assert.deepEqual(
    plan.telemetryEvents.map((event) => event.type),
    ["decorate_submit_received", "student_decorate_cta_clicked", "decorate_dispatch_blocked"],
  );
  assert.equal(plan.telemetryEvents[2]?.extra.reasonCategory, "input");
});

test("student coach action plan keeps retry semantics and start telemetry aligned", () => {
  const plan = createStudentCoachActionPlan({
    source: "fallback_retry",
    inputValue: "방금 요청 다시 시도해줘",
    isGeneratingFiles: false,
    coachUnavailable: false,
    isOpsModeLocked: false,
    createRequestId: () => "req_student_coach_dispatch",
  });

  assert.equal(plan.effect.kind, "start");
  assert.equal(plan.decision.kind, "start");
  assert.equal(plan.decision.mode, "retry");
  assert.deepEqual(
    plan.telemetryEvents.map((event) => event.type),
    ["coach_submit_received", "coach_dispatch_started"],
  );
  assert.equal(plan.telemetryEvents[1]?.extra.requestIdOwnership, "new");
});

test("student coach blocked plan preserves reason-category telemetry", () => {
  const plan = createStudentCoachActionPlan({
    source: "submit",
    inputValue: "소개 문구를 추천해줘",
    isGeneratingFiles: false,
    coachUnavailable: false,
    isOpsModeLocked: true,
    createRequestId: () => "req_unused",
  });

  assert.equal(plan.effect.kind, "blocked");
  assert.equal(plan.decision.kind, "blocked");
  assert.deepEqual(
    plan.telemetryEvents.map((event) => event.type),
    ["coach_submit_received", "coach_dispatch_blocked"],
  );
  assert.equal(plan.telemetryEvents[1]?.extra.reasonCategory, "policy");
});
