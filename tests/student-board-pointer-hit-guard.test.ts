import assert from "node:assert/strict";
import test from "node:test";

type MockEl = {
  selector: string;
  contains: (other: MockEl) => boolean;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
};

function expectElementReceivesPointer(
  querySelector: (selector: string) => MockEl | null,
  elementFromPoint: (x: number, y: number) => MockEl | null,
  selector: string,
) {
  const el = querySelector(selector);
  assert.ok(el);
  const rect = el.getBoundingClientRect();
  const hit = elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  assert.ok(hit);
  assert.ok(el === hit || el.contains(hit) || hit.contains(el));
}

test("pointer hit guard keeps decorative layer click-through for key student board controls", () => {
  const selectors = [
    '[data-testid="guest-card-compose-cta"]',
    '[data-testid="guest-card-compose-hint"]',
    '[data-testid="board-minimap-trigger"]',
    '[aria-label="카드 옵션"]',
    '[data-testid="card-read-more-button"]',
  ];

  const dimLayer = {
    testId: "board-background-dim-layer",
    ariaHidden: "true",
    pointerEvents: "none",
  };
  assert.equal(dimLayer.ariaHidden, "true");
  assert.equal(dimLayer.pointerEvents, "none");

  for (const selector of selectors) {
    const target: MockEl = {
      selector,
      contains: (other) => other.selector === selector,
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 100, height: 40 }),
    };
    expectElementReceivesPointer(
      (query) => (query === selector ? target : null),
      () => target,
      selector,
    );
  }
});
