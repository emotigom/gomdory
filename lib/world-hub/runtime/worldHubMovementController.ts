import type { WorldHubPlayerState } from "@/lib/world-hub/contracts";

export type WorldHubMovementInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type WorldHubMovementVelocity = {
  x: number;
  y: number;
};

export type WorldHubMovementBounds = {
  width: number;
  height: number;
};

export type WorldHubMovementTunables = {
  maxWalkSpeed: number;
  acceleration: number;
  deceleration: number;
  headingTurnRateDegPerSec: number;
  boundaryPadding: number;
  headingSpeedThreshold: number;
};

export const DEFAULT_WORLD_HUB_MOVEMENT_TUNABLES: WorldHubMovementTunables = {
  maxWalkSpeed: 9,
  acceleration: 24,
  deceleration: 20,
  headingTurnRateDegPerSec: 480,
  boundaryPadding: 4,
  headingSpeedThreshold: 0.2,
};

const MOVEMENT_INTENT_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"] as const;

export function isWorldHubMovementIntentKey(key: string): boolean {
  return (MOVEMENT_INTENT_KEYS as readonly string[]).includes(key.toLowerCase());
}

export function resolveWorldHubMovementInputFromPressedKeys(pressed: ReadonlySet<string>): WorldHubMovementInput {
  return {
    up: pressed.has("w") || pressed.has("arrowup"),
    down: pressed.has("s") || pressed.has("arrowdown"),
    left: pressed.has("a") || pressed.has("arrowleft"),
    right: pressed.has("d") || pressed.has("arrowright"),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngleDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestSignedAngleDelta(fromDeg: number, toDeg: number) {
  const from = normalizeAngleDegrees(fromDeg);
  const to = normalizeAngleDegrees(toDeg);
  const delta = to - from;
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

function moveVectorToward(args: {
  current: WorldHubMovementVelocity;
  target: WorldHubMovementVelocity;
  maxDelta: number;
}): WorldHubMovementVelocity {
  const deltaX = args.target.x - args.current.x;
  const deltaY = args.target.y - args.current.y;
  const deltaMagnitude = Math.hypot(deltaX, deltaY);
  if (deltaMagnitude === 0 || args.maxDelta <= 0) {
    return args.current;
  }
  if (deltaMagnitude <= args.maxDelta) {
    return args.target;
  }
  const scale = args.maxDelta / deltaMagnitude;
  return {
    x: args.current.x + deltaX * scale,
    y: args.current.y + deltaY * scale,
  };
}

export function integrateWorldHubMovement(args: {
  player: WorldHubPlayerState;
  velocity: WorldHubMovementVelocity;
  input: WorldHubMovementInput;
  bounds: WorldHubMovementBounds;
  deltaSeconds: number;
  tunables?: Partial<WorldHubMovementTunables>;
}): {
  player: WorldHubPlayerState;
  velocity: WorldHubMovementVelocity;
} {
  const tunables: WorldHubMovementTunables = {
    ...DEFAULT_WORLD_HUB_MOVEMENT_TUNABLES,
    ...args.tunables,
  };

  const deltaSeconds = Math.max(0, args.deltaSeconds);
  const dx = Number(args.input.right) - Number(args.input.left);
  const dy = Number(args.input.down) - Number(args.input.up);
  const intentMagnitude = Math.hypot(dx, dy);
  const hasIntent = intentMagnitude > 0;

  let nextVelocityX = args.velocity.x;
  let nextVelocityY = args.velocity.y;

  if (hasIntent) {
    const intentX = dx / intentMagnitude;
    const intentY = dy / intentMagnitude;
    const targetVelocityX = intentX * tunables.maxWalkSpeed;
    const targetVelocityY = intentY * tunables.maxWalkSpeed;
    const nextVelocity = moveVectorToward({
      current: { x: nextVelocityX, y: nextVelocityY },
      target: { x: targetVelocityX, y: targetVelocityY },
      maxDelta: tunables.acceleration * deltaSeconds,
    });
    nextVelocityX = nextVelocity.x;
    nextVelocityY = nextVelocity.y;
  } else {
    const nextVelocity = moveVectorToward({
      current: { x: nextVelocityX, y: nextVelocityY },
      target: { x: 0, y: 0 },
      maxDelta: tunables.deceleration * deltaSeconds,
    });
    nextVelocityX = nextVelocity.x;
    nextVelocityY = nextVelocity.y;
  }

  const minX = tunables.boundaryPadding;
  const minY = tunables.boundaryPadding;
  const maxX = Math.max(minX, args.bounds.width - tunables.boundaryPadding);
  const maxY = Math.max(minY, args.bounds.height - tunables.boundaryPadding);

  let nextPositionX = args.player.position.x + nextVelocityX * deltaSeconds;
  let nextPositionY = args.player.position.y + nextVelocityY * deltaSeconds;
  const clampedPositionX = clamp(nextPositionX, minX, maxX);
  const clampedPositionY = clamp(nextPositionY, minY, maxY);

  if (clampedPositionX !== nextPositionX) {
    nextVelocityX = 0;
    nextPositionX = clampedPositionX;
  } else {
    nextPositionX = clampedPositionX;
  }

  if (clampedPositionY !== nextPositionY) {
    nextVelocityY = 0;
    nextPositionY = clampedPositionY;
  } else {
    nextPositionY = clampedPositionY;
  }

  const nextSpeed = Math.hypot(nextVelocityX, nextVelocityY);
  let nextHeading = args.player.heading;

  const headingDirectionX = nextSpeed > tunables.headingSpeedThreshold ? nextVelocityX : hasIntent ? dx : 0;
  const headingDirectionY = nextSpeed > tunables.headingSpeedThreshold ? nextVelocityY : hasIntent ? dy : 0;

  if (headingDirectionX !== 0 || headingDirectionY !== 0) {
    const targetHeading = (Math.atan2(headingDirectionY, headingDirectionX) * 180) / Math.PI;
    const maxHeadingDelta = tunables.headingTurnRateDegPerSec * deltaSeconds;
    const headingDelta = shortestSignedAngleDelta(args.player.heading, targetHeading);
    const clampedHeadingDelta = clamp(headingDelta, -maxHeadingDelta, maxHeadingDelta);
    nextHeading = normalizeAngleDegrees(args.player.heading + clampedHeadingDelta);
  }

  return {
    player: {
      ...args.player,
      position: { x: nextPositionX, y: nextPositionY },
      heading: nextHeading,
      speed: nextSpeed,
    },
    velocity: {
      x: nextVelocityX,
      y: nextVelocityY,
    },
  };
}
