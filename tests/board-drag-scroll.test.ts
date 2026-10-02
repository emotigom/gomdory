import test from "node:test";
import assert from "node:assert/strict";

import {
  computeClampedScroll,
  computeEdgeScrollDelta,
  computeNextScrollLeft,
  shouldContinueAutoScrollLoop,
} from "@/lib/board/dragScroll";

test("computeNextScrollLeft clamps horizontal scroll within bounds", () => {
  assert.equal(computeNextScrollLeft({ current: 10, direction: -1, delta: 20, max: 100 }), 0);
  assert.equal(computeNextScrollLeft({ current: 90, direction: 1, delta: 20, max: 100 }), 100);
});

test("computeNextScrollLeft no-ops when there is no movement", () => {
  assert.equal(computeNextScrollLeft({ current: 30, direction: 0, delta: 20, max: 100 }), 30);
  assert.equal(computeNextScrollLeft({ current: 30, direction: 1, delta: 0, max: 100 }), 30);
  assert.equal(computeNextScrollLeft({ current: 30, direction: 1, delta: 20, max: 0 }), 30);
});

test("computeEdgeScrollDelta returns signed eased values in edge zones", () => {
  const rect = { left: 100, right: 500, top: 200, bottom: 700 } as DOMRect;

  const leftDelta = computeEdgeScrollDelta({
    pointer: 105,
    rect,
    axis: "x",
    zonePx: 80,
    maxSpeedPxPerFrame: 20,
  });
  const rightDelta = computeEdgeScrollDelta({
    pointer: 495,
    rect,
    axis: "x",
    zonePx: 80,
    maxSpeedPxPerFrame: 20,
  });
  const centerDelta = computeEdgeScrollDelta({
    pointer: 300,
    rect,
    axis: "x",
    zonePx: 80,
    maxSpeedPxPerFrame: 20,
  });

  assert.ok(leftDelta < 0);
  assert.ok(rightDelta > 0);
  assert.equal(centerDelta, 0);
  assert.ok(Math.abs(leftDelta) > 0);
  assert.ok(Math.abs(rightDelta) > 0);
});

test("computeClampedScroll clamps deltas and no-ops at limits", () => {
  assert.equal(computeClampedScroll({ current: 10, delta: -30, max: 100 }), 0);
  assert.equal(computeClampedScroll({ current: 90, delta: 50, max: 100 }), 100);
  assert.equal(computeClampedScroll({ current: 0, delta: -10, max: 100 }), 0);
});

test("shouldContinueAutoScrollLoop stops when clamped no-op", () => {
  assert.equal(
    shouldContinueAutoScrollLoop({ deltaX: 12, deltaY: 0, movedX: false, movedY: false }),
    false,
  );
  assert.equal(
    shouldContinueAutoScrollLoop({ deltaX: 0, deltaY: -10, movedX: false, movedY: false }),
    false,
  );
  assert.equal(
    shouldContinueAutoScrollLoop({ deltaX: 8, deltaY: 0, movedX: true, movedY: false }),
    true,
  );
});
