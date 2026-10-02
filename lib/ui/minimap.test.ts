import assert from "node:assert/strict";
import test from "node:test";

import {
  calcViewportRectRatios,
  computeCanvasSize,
  computeMinimapBounds,
  ensurePointerEventsPolicy,
  mapMinimapPointToWorldPoint,
  mapMinimapPointToScroll,
  mapWorldRectToMinimapRect,
  shouldRedrawMinimapFromMutations,
} from "@/lib/ui/minimap";

const assertNearlyEqual = (actual: number, expected: number) => {
  assert.ok(Math.abs(actual - expected) < 0.000001, `expected ${actual} to be nearly ${expected}`);
};

test("calcViewportRectRatios computes viewport ratios against scrollable range", () => {
  const rect = calcViewportRectRatios({
    scrollLeft: 150,
    scrollTop: 300,
    scrollWidth: 1000,
    scrollHeight: 2000,
    clientWidth: 400,
    clientHeight: 500,
  });

  assert.equal(rect.width, 0.4);
  assert.equal(rect.height, 0.25);
  assert.equal(rect.left, 0.25);
  assert.equal(rect.top, 0.2);
});

test("mapMinimapPointToScroll maps minimap ratios into scroll offsets", () => {
  const target = mapMinimapPointToScroll({
    ratioX: 0.5,
    ratioY: 0.75,
    scrollWidth: 1200,
    scrollHeight: 2400,
    clientWidth: 400,
    clientHeight: 600,
  });

  assert.equal(target.left, 400);
  assert.equal(target.top, 1350);
});

test("computeCanvasSize returns stable css/pixel dimensions with dpr", () => {
  const size = computeCanvasSize({ cssWidth: 233.8, cssHeight: 120.2, dpr: 2 });

  assert.deepEqual(size, {
    cssWidth: 233,
    cssHeight: 120,
    dpr: 2,
    pixelWidth: 466,
    pixelHeight: 240,
  });
});

test("ensurePointerEventsPolicy keeps minimap root transparent to wheel routing", () => {
  const policy = ensurePointerEventsPolicy();

  assert.deepEqual(policy, {
    rootPointerEvents: "none",
    panelPointerEvents: "auto",
    buttonPointerEvents: "auto",
    overlayPointerEvents: "none",
  });
});

test("shouldRedrawMinimapFromMutations ignores non-structure changes", () => {
  assert.equal(
    shouldRedrawMinimapFromMutations([
      {
        type: "attributes",
        targetDataset: { scroll: "wall-column", wallId: "w1" },
      },
      {
        type: "childList",
        targetDataset: { random: "node" },
        addedDatasets: [{ random: "child" }],
      },
    ]),
    false,
  );
});

test("shouldRedrawMinimapFromMutations reacts to card/column count changes", () => {
  assert.equal(
    shouldRedrawMinimapFromMutations([
      {
        type: "childList",
        targetDataset: { scroll: "wall-column", wallId: "w1" },
        addedDatasets: [{ cardId: "c1" }],
      },
    ]),
    true,
  );
});


test("computeMinimapBounds handles empty and mixed coordinates", () => {
  const empty = computeMinimapBounds([]);
  assert.equal(empty.width > 0, true);

  const bounds = computeMinimapBounds([
    { x: -100, y: 20, width: 50, height: 80 },
    { x: 4000, y: -300, width: 120, height: 60 },
  ]);
  assert.equal(bounds.minX, -100);
  assert.equal(bounds.minY, -300);
  assert.equal(bounds.maxX, 4120);
  assert.equal(bounds.maxY, 100);
});

test("computeMinimapBounds handles zero-size items and section-only sets", () => {
  const bounds = computeMinimapBounds([
    { x: 100, y: 200, width: 0, height: 0, type: "section" },
    { x: 120, y: 240, width: 0, height: 32, type: "section" },
  ]);
  assert.equal(bounds.width > 0, true);
  assert.equal(bounds.height > 0, true);
});

test("computeMinimapBounds handles card-only, negative, and very large coordinates", () => {
  const bounds = computeMinimapBounds([
    { x: -5000, y: -2500, width: 200, height: 100, type: "card" },
    { x: 1_000_000, y: 2_000_000, width: 400, height: 300, type: "card" },
  ]);
  assert.equal(Number.isFinite(bounds.width), true);
  assert.equal(Number.isFinite(bounds.height), true);
  assert.equal(bounds.minX <= -5000, true);
  assert.equal(bounds.maxY >= 2_000_300, true);
});

test("mapWorldRectToMinimapRect returns finite values", () => {
  const bounds = computeMinimapBounds([{ x: 0, y: 0, width: 1000, height: 500 }]);
  const mapped = mapWorldRectToMinimapRect({
    rect: { x: 250, y: 100, width: 200, height: 100 },
    bounds,
    miniWidth: 300,
    miniHeight: 200,
    padding: 8,
  });
  assert.equal(Number.isFinite(mapped.x), true);
  assert.equal(Number.isFinite(mapped.y), true);
  assert.equal(Number.isFinite(mapped.width), true);
  assert.equal(Number.isFinite(mapped.height), true);
  assert.equal(mapped.width > 0, true);
  assert.equal(mapped.height > 0, true);
});

test("mapWorldRectToMinimapRect keeps finite scale with padded bounds", () => {
  const bounds = computeMinimapBounds(
    [
      { x: 0, y: 0, width: 0, height: 0, type: "section" },
      { x: 400, y: 50, width: 0, height: 40, type: "card" },
    ],
    24,
  );
  const mapped = mapWorldRectToMinimapRect({
    rect: { x: 0, y: 0, width: 0, height: 0, type: "section" },
    bounds,
    miniWidth: 300,
    miniHeight: 180,
    padding: 12,
  });
  assert.equal(Number.isFinite(mapped.scale), true);
  assert.equal(mapped.scale > 0, true);
});

test("mapMinimapPointToWorldPoint maps minimap center into world center", () => {
  const bounds = computeMinimapBounds([{ x: 0, y: 0, width: 1000, height: 500 }]);
  const point = mapMinimapPointToWorldPoint({
    x: 150,
    y: 79,
    bounds,
    miniWidth: 300,
    miniHeight: 158,
    padding: 8,
  });

  assertNearlyEqual(point.x, 500);
  assertNearlyEqual(point.y, 250);
});

test("mapMinimapPointToWorldPoint maps minimap top-left into world min", () => {
  const bounds = computeMinimapBounds([{ x: -100, y: 50, width: 400, height: 200 }]);
  const point = mapMinimapPointToWorldPoint({
    x: 8,
    y: 8,
    bounds,
    miniWidth: 416,
    miniHeight: 216,
    padding: 8,
  });

  assert.equal(point.x, -100);
  assert.equal(point.y, 50);
});

test("mapMinimapPointToWorldPoint clamps points and handles degenerate minimap size", () => {
  const bounds = computeMinimapBounds([{ x: 10, y: 20, width: 100, height: 50 }]);
  const clamped = mapMinimapPointToWorldPoint({
    x: -100,
    y: 999,
    bounds,
    miniWidth: 0,
    miniHeight: 0,
    padding: 8,
  });

  assert.equal(Number.isFinite(clamped.x), true);
  assert.equal(Number.isFinite(clamped.y), true);
  assert.equal(clamped.x, 10);
  assert.equal(clamped.y, 70);
});
