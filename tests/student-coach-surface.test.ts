import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");
const orchestrationSource = fs.readFileSync("lib/edu/lesson/studentChatPanelOrchestration.ts", "utf8");

test("coach submit surfaces route through the authoritative orchestration helper", () => {
  assert.equal(chatPanelSource.includes("createStudentCoachActionPlan"), true);
  assert.equal(orchestrationSource.includes("resolveStudentCoachDispatchDecision"), true);
  assert.equal(orchestrationSource.includes('type: "coach_submit_received"'), true);
  assert.equal(orchestrationSource.includes('type: "coach_dispatch_started"'), true);
  assert.equal(orchestrationSource.includes('type: "coach_dispatch_blocked"'), true);
  assert.equal(orchestrationSource.includes("requestIdOwnership: decision.requestIdOwnership"), true);
  assert.equal(orchestrationSource.includes("reasonCategory: decision.reasonCategory"), true);
});

test("coach entrypoints stamp explicit submit sources before the shared submit handler runs", () => {
  assert.equal(chatPanelSource.includes('coachSubmitSourceRef.current = "enter"'), true);
  assert.equal(chatPanelSource.includes('coachSubmitSourceRef.current = "send_button"'), true);
  assert.equal(chatPanelSource.includes('runCoachPrimaryAction("fallback_retry", lastUserMessage)'), true);
});
