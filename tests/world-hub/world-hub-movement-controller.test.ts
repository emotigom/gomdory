import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubPlayerState } from "@/lib/world-hub/contracts";
import {
  integrateWorldHubMovement,
  isWorldHubMovementIntentKey,
  resolveWorldHubMovementInputFromPressedKeys,
} from "@/lib/world-hub/runtime/worldHubMovementController";

const BOUNDS = { width: 100, height: 100 };

function createPlayer(overrides: Partial<WorldHubPlayerState> = {}): WorldHubPlayerState {
  return {
    position: { x: 50, y: 50 },
    heading: 0,
    speed: 0,
    activePortalId: null,
    ...overrides,
  };
}

test("no input decays velocity and speed toward zero", () => {
  const first = integrateWorldHubMovement({
    player: createPlayer({ speed: 6 }),
    velocity: { x: 6, y: 0 },
    input: { up: false, down: false, left: false, right: false },
    bounds: BOUNDS,
    deltaSeconds: 0.1,
  });

  assert.ok(first.player.speed < 6);
  assert.ok(first.player.position.x > 50);

  const settled = integrateWorldHubMovement({
    player: first.player,
    velocity: first.velocity,
    input: { up: false, down: false, left: false, right: false },
    bounds: BOUNDS,
    deltaSeconds: 0.8,
  });

  assert.equal(settled.player.speed, 0);
  assert.equal(settled.velocity.x, 0);
});

test("sustained forward input ramps speed to capped max speed", () => {
  let player = createPlayer();
  let velocity = { x: 0, y: 0 };

  for (let index = 0; index < 100; index += 1) {
    const next = integrateWorldHubMovement({
      player,
      velocity,
      input: { up: true, down: false, left: false, right: false },
      bounds: BOUNDS,
      deltaSeconds: 0.016,
      tunables: { maxWalkSpeed: 8.5 },
    });
    player = next.player;
    velocity = next.velocity;
  }

  assert.ok(player.speed <= 8.5 + 0.0001);
  assert.ok(player.speed > 8.2);
});

test("diagonal input normalizes so it is not faster than cardinal", () => {
  const cardinal = integrateWorldHubMovement({
    player: createPlayer(),
    velocity: { x: 0, y: 0 },
    input: { up: true, down: false, left: false, right: false },
    bounds: BOUNDS,
    deltaSeconds: 0.25,
  });

  const diagonal = integrateWorldHubMovement({
    player: createPlayer(),
    velocity: { x: 0, y: 0 },
    input: { up: true, down: false, left: false, right: true },
    bounds: BOUNDS,
    deltaSeconds: 0.25,
  });

  assert.ok(Math.abs(cardinal.player.speed - diagonal.player.speed) < 0.0001);
  assert.ok(Math.hypot(diagonal.velocity.x, diagonal.velocity.y) <= cardinal.player.speed + 0.0001);
});

test("heading turns smoothly toward direction instead of snapping in one frame", () => {
  const next = integrateWorldHubMovement({
    player: createPlayer({ heading: 0 }),
    velocity: { x: 0, y: 0 },
    input: { up: false, down: true, left: false, right: false },
    bounds: BOUNDS,
    deltaSeconds: 0.016,
    tunables: { headingTurnRateDegPerSec: 180 },
  });

  assert.ok(next.player.heading > 0);
  assert.ok(next.player.heading < 90);
});

test("movement remains clamped to scene bounds", () => {
  const next = integrateWorldHubMovement({
    player: createPlayer({ position: { x: 95.5, y: 50 } }),
    velocity: { x: 9, y: 0 },
    input: { up: false, down: false, left: false, right: true },
    bounds: BOUNDS,
    deltaSeconds: 0.4,
  });

  assert.equal(next.player.position.x, 96);
  assert.equal(next.velocity.x, 0);
});

test("releasing input does not hard-stop in a single short frame", () => {
  const moving = integrateWorldHubMovement({
    player: createPlayer(),
    velocity: { x: 0, y: 0 },
    input: { up: false, down: false, left: false, right: true },
    bounds: BOUNDS,
    deltaSeconds: 0.16,
  });

  const released = integrateWorldHubMovement({
    player: moving.player,
    velocity: moving.velocity,
    input: { up: false, down: false, left: false, right: false },
    bounds: BOUNDS,
    deltaSeconds: 0.016,
  });

  assert.ok(released.player.speed > 0);
  assert.ok(released.player.speed < moving.player.speed);
});

test("movement intent mapping supports WASD and arrow keys", () => {
  assert.equal(isWorldHubMovementIntentKey("w"), true);
  assert.equal(isWorldHubMovementIntentKey("ArrowRight"), true);
  assert.equal(isWorldHubMovementIntentKey("e"), false);

  const pressed = new Set(["w", "arrowleft"]);
  assert.deepEqual(resolveWorldHubMovementInputFromPressedKeys(pressed), {
    up: true,
    down: false,
    left: true,
    right: false,
  });
});
