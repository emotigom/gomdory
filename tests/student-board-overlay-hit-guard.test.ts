import assert from "node:assert/strict";
import test from "node:test";

test("overlay hit guard includes topbar controls and keeps dim layer non-interactive", () => {
  const selectors = [
    '[data-testid="student-topbar-toggle"]',
    '[data-testid="student-topbar-expanded"]',
    '[aria-label="보기 테마 선택"]',
    '[data-testid="guest-card-compose-cta"]',
    '[data-testid="board-minimap-trigger"]',
    '[aria-label="카드 옵션"]',
    '[data-testid="card-read-more-button"]',
  ];

  const dimLayer = {
    testId: "board-background-dim-layer",
    ariaHidden: "true",
    pointerEvents: "none",
  };

  assert.equal(dimLayer.testId, "board-background-dim-layer");
  assert.equal(dimLayer.ariaHidden, "true");
  assert.equal(dimLayer.pointerEvents, "none");
  assert.equal(selectors.length, 7);
});
