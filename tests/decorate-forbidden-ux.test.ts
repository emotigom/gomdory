import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");

test("forbidden retry-required decorate copy is absent", () => {
  assert.equal(chatPanelSource.includes("다시 시도하면 바로 적용"), false);
});

test("first-click path has no interstitial blocking copy", () => {
  assert.equal(chatPanelSource.includes("잠깐! 버튼으로 먼저 바꿔볼까"), false);
});

test("decorate progress uses student copy helper", () => {
  assert.equal(chatPanelSource.includes('getStudentDecorateResultCopy("apply_start")'), true);
  assert.equal(chatPanelSource.includes('getStudentDecorateResultCopy("applied")'), true);
});

test("decorate lifecycle/post-commit interference guards are wired", () => {
  assert.equal(chatPanelSource.includes("decorate_lifecycle_interference_blocked"), true);
  assert.equal(chatPanelSource.includes("decorate_post_commit_interference_blocked"), true);
});
