import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WALL_WIDTH,
  MAX_WALL_WIDTH,
  MIN_WALL_WIDTH,
  RESIZE_STEPS,
  clampWallWidth,
  getAdjacentWallWidth,
  snapWallWidth,
} from "@/lib/ui/wallResize";

test("wall resize constants include narrower baseline options", () => {
  assert.equal(MIN_WALL_WIDTH, 240);
  assert.deepEqual(RESIZE_STEPS, [240, 300, 360, 420, 480, 560, 640, 720, 840, 960]);
  assert.equal(RESIZE_STEPS[2], 360);
  assert.equal(RESIZE_STEPS[1], 300);
});

test("wall width clamps to 240 minimum", () => {
  assert.equal(clampWallWidth(200), 240);
  assert.equal(snapWallWidth(200), 240);
});

test("wall width snaps to nearest step around 250", () => {
  assert.equal(snapWallWidth(250), 240);
  assert.equal(snapWallWidth(271), 300);
  assert.equal(snapWallWidth(250, false), 250);
});

test("wall keyboard resize moves one step and clamps at both ends", () => {
  assert.equal(getAdjacentWallWidth(360, "left"), 300);
  assert.equal(getAdjacentWallWidth(360, "right"), 420);
  assert.equal(getAdjacentWallWidth(MIN_WALL_WIDTH, "left"), MIN_WALL_WIDTH);
  assert.equal(getAdjacentWallWidth(MAX_WALL_WIDTH, "right"), MAX_WALL_WIDTH);
});

test("wall divider reset default remains 360", () => {
  assert.equal(DEFAULT_WALL_WIDTH, 360);
  assert.equal(clampWallWidth(DEFAULT_WALL_WIDTH), 360);
});
