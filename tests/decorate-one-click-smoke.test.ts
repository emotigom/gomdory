import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");

test("forbidden retry-required decorate copy is removed", () => {
  assert.equal(chatPanelSource.includes("다시 시도하면 바로 적용해요"), false);
});

test("slot-choice interstitial copy is removed from first-click flow", () => {
  assert.equal(chatPanelSource.includes("잠깐! 버튼으로 먼저 바꿔볼까?"), false);
});

test("decorate transaction telemetry is emitted on start", () => {
  assert.equal(chatPanelSource.includes("decorate_transaction_started"), true);
});
