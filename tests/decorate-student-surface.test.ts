import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");
const studentSurfaceSource = fs.readFileSync("app/edu/_components/StudentDecorateSurface.tsx", "utf8");
const executionSource = fs.readFileSync("lib/edu/lesson/studentDecorateExecution.ts", "utf8");
const orchestrationSource = fs.readFileSync("lib/edu/lesson/studentChatPanelOrchestration.ts", "utf8");

test("student decorate surface is split into dedicated component", () => {
  assert.equal(chatPanelSource.includes("import StudentDecorateSurface"), true);
  assert.equal(chatPanelSource.includes("{isStudentDecorateSurface ? ("), true);
  assert.equal(studentSurfaceSource.includes("export default function StudentDecorateSurface"), true);
});

test("enter, bottom send, and green CTA stay unified to one primary action", () => {
  assert.equal(chatPanelSource.includes('onEnterSubmit={() => runStudentPrimaryAction("enter")}'), true);
  assert.equal(chatPanelSource.includes('onBottomSendClick={() => runStudentPrimaryAction("send")}'), true);
  assert.equal(chatPanelSource.includes('onPrimaryCtaClick={() => runStudentPrimaryAction("cta")}'), true);
});

test("student primary action now resolves through a shared orchestration helper", () => {
  assert.equal(chatPanelSource.includes("createStudentDecorateActionPlan"), true);
  assert.equal(orchestrationSource.includes("resolveStudentDecorateDispatchDecision"), true);
  assert.equal(executionSource.includes('kind: "start"'), true);
  assert.equal(executionSource.includes('kind: "apply"'), true);
  assert.equal(executionSource.includes('kind: "blocked"'), true);
});

test("student CTA telemetry remains stable and uses the resolved request id", () => {
  assert.equal(chatPanelSource.includes("recordStudentChatPanelTelemetryEvents(plan.telemetryEvents, shareCode)"), true);
  assert.equal(orchestrationSource.includes('type: "decorate_submit_received"'), true);
  assert.equal(orchestrationSource.includes('type: "student_decorate_cta_clicked"'), true);
  assert.equal(orchestrationSource.includes('type: "decorate_dispatch_blocked"'), true);
  assert.equal(orchestrationSource.includes("requestIdOwnership: decision.requestIdOwnership"), true);
  assert.equal(orchestrationSource.includes("reasonCategory: decision.reasonCategory"), true);
  assert.equal(studentSurfaceSource.includes('data-testid="student-decorate-primary-cta"'), true);
});

test("student apply path still clears pending preview and returns to idle", () => {
  assert.equal(chatPanelSource.includes('decoratePendingApplyRef.current = null;'), true);
  assert.equal(chatPanelSource.includes('setDecorateHasPendingApply(false);'), true);
  assert.equal(chatPanelSource.includes('setStudentDecorateUiState("idle")'), true);
});
