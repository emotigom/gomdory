import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");
const executionSource = fs.readFileSync("lib/edu/lesson/studentDecorateExecution.ts", "utf8");

test("apply success clears pending preview and resets student ui state", () => {
  const applyBlock = /const applyStudentDecoratePreview = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[applyPendingDecorate, shareCode, studentDecorateUiState\]\);/.exec(source)?.[0] ?? "";
  assert.equal(applyBlock.includes("setDecorateHasPendingApply(false)"), true);
  assert.equal(applyBlock.includes('setStudentDecorateUiState("idle")'), true);
  assert.equal(applyBlock.includes('reason: "apply_commit"'), true);
});

test("failed student decorate state is allowed to start a new request", () => {
  assert.equal(executionSource.includes('state === "idle" || state === "failed"'), true);
  assert.equal(source.includes("void startStudentDecorate(plan.effect.prompt, plan.effect.requestId);"), true);
});

test("all student surface entry points continue to use the same dispatch path", () => {
  assert.equal(source.includes("createStudentDecorateActionPlan"), true);
  assert.equal(source.includes('void applyStudentDecoratePreview();'), true);
  assert.equal(source.includes("void startStudentDecorate(plan.effect.prompt, plan.effect.requestId);"), true);
});
