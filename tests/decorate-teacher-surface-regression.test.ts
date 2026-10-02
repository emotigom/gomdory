import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");

test("teacher/template controls are still present and separated from student surface", () => {
  assert.equal(chatPanelSource.includes('const showTemplateApplyButton = canShowDecorateAssistUi && isTemplateFirst && isTeacherMode && Boolean(lastUserMessage);'), true);
  assert.equal(chatPanelSource.includes('!isStudentDecorateSurface && showWaitingActions'), true);
  assert.equal(chatPanelSource.includes('if (!isTeacherMode && isTemplateFirst) {'), true);
  assert.equal(chatPanelSource.includes('void generateFilesFromHistory();'), true);
});
