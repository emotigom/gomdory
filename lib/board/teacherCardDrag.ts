export const TEACHER_CARD_DRAG_ACTIVATION_DELAY_MS = 220;
export const TEACHER_CARD_DRAG_MOVE_TOLERANCE_PX = 6;
export const TEACHER_CARD_DRAG_AUTO_SCROLL_EDGE_PX = 72;
export const TEACHER_CARD_DRAG_AUTO_SCROLL_MAX_X_PX_PER_FRAME = 24;
export const TEACHER_CARD_DRAG_AUTO_SCROLL_MAX_Y_PX_PER_FRAME = 20;

const CARD_DRAG_BLOCKED_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "audio",
  "video",
  '[contenteditable="true"]',
  "[data-no-card-drag]",
  '[data-interactive="true"]',
  '[role="menu"]',
  '[role="menuitem"]',
].join(",");

type ClosestCapableTarget = EventTarget & {
  closest?: (selector: string) => unknown;
};

export type TeacherCardDragPointerStart = {
  pointerType: string;
  button: number;
  target: EventTarget | null;
};

export type TeacherCardDragRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TeacherCardDragCardRect = {
  cardId: string;
  rect: TeacherCardDragRect;
};

export type TeacherCardDragWallRect = {
  wallId: string;
  rect: TeacherCardDragRect;
  cards: TeacherCardDragCardRect[];
};

export type TeacherCardDropPositionInput = {
  pointer: { x: number; y: number };
  walls: TeacherCardDragWallRect[];
  draggingCardId: string;
  currentWallId: string;
  currentPosition: number;
};

export type TeacherCardDropPosition = {
  wallId: string;
  position: number;
};

export type TeacherCardAutoScrollRect = Pick<
  TeacherCardDragRect,
  "top" | "right" | "bottom" | "left"
>;

export type TeacherCardAutoScrollDeltaInput = {
  pointer: { x: number; y: number };
  boardRect: TeacherCardAutoScrollRect | null;
  columnRect: TeacherCardAutoScrollRect | null;
  edgePx?: number;
  maxXPerFrame?: number;
  maxYPerFrame?: number;
};

export type TeacherCardAutoScrollDelta = {
  x: number;
  y: number;
};

export function isCardDragBlockedTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const closest = (target as ClosestCapableTarget).closest;
  if (typeof closest !== "function") return false;
  return Boolean(closest.call(target, CARD_DRAG_BLOCKED_SELECTOR));
}

export function isTeacherCardDragPointerCandidate(
  event: TeacherCardDragPointerStart,
): boolean {
  return (
    event.pointerType === "mouse" &&
    event.button === 0 &&
    !isCardDragBlockedTarget(event.target)
  );
}

export function calculateTeacherCardDropPosition({
  pointer,
  walls,
  draggingCardId,
  currentWallId,
  currentPosition,
}: TeacherCardDropPositionInput): TeacherCardDropPosition {
  const containingWall = walls.find((wall) => isPointInsideRect(pointer, wall.rect));

  if (!containingWall) {
    const currentWall = walls.find((wall) => wall.wallId === currentWallId);
    if (currentWall) {
      return {
        wallId: currentWall.wallId,
        position: clampPosition(currentPosition, currentWall.cards.length - 1),
      };
    }

    const nearestWall = findNearestWall(pointer, walls);
    if (!nearestWall) return { wallId: currentWallId, position: Math.max(0, Math.floor(currentPosition)) };
    return {
      wallId: nearestWall.wallId,
      position: calculatePositionWithinWall(pointer.y, nearestWall, draggingCardId),
    };
  }

  return {
    wallId: containingWall.wallId,
    position: calculatePositionWithinWall(pointer.y, containingWall, draggingCardId),
  };
}

export function calculateTeacherCardAutoScrollDelta({
  pointer,
  boardRect,
  columnRect,
  edgePx = TEACHER_CARD_DRAG_AUTO_SCROLL_EDGE_PX,
  maxXPerFrame = TEACHER_CARD_DRAG_AUTO_SCROLL_MAX_X_PX_PER_FRAME,
  maxYPerFrame = TEACHER_CARD_DRAG_AUTO_SCROLL_MAX_Y_PX_PER_FRAME,
}: TeacherCardAutoScrollDeltaInput): TeacherCardAutoScrollDelta {
  return {
    x: boardRect
      ? calculateEdgeDelta({
          pointer: pointer.x,
          start: boardRect.left,
          end: boardRect.right,
          edgePx,
          maxPerFrame: maxXPerFrame,
        })
      : 0,
    y: columnRect
      ? calculateEdgeDelta({
          pointer: pointer.y,
          start: columnRect.top,
          end: columnRect.bottom,
          edgePx,
          maxPerFrame: maxYPerFrame,
        })
      : 0,
  };
}

function calculatePositionWithinWall(
  pointerY: number,
  wall: TeacherCardDragWallRect,
  draggingCardId: string,
) {
  const candidateCards = wall.cards
    .filter((card) => card.cardId !== draggingCardId)
    .toSorted((a, b) => {
      const topDelta = a.rect.top - b.rect.top;
      if (topDelta !== 0) return topDelta;
      return a.rect.left - b.rect.left;
    });

  if (candidateCards.length === 0) return 0;

  const insertionIndex = candidateCards.findIndex((card) => {
    const midpointY = card.rect.top + (card.rect.bottom - card.rect.top) / 2;
    return pointerY < midpointY;
  });

  return insertionIndex === -1 ? candidateCards.length : insertionIndex;
}

function isPointInsideRect(
  pointer: { x: number; y: number },
  rect: TeacherCardDragRect,
) {
  return (
    pointer.x >= rect.left &&
    pointer.x <= rect.right &&
    pointer.y >= rect.top &&
    pointer.y <= rect.bottom
  );
}

function clampPosition(position: number, maxPosition: number) {
  if (!Number.isFinite(position)) return 0;
  return Math.min(Math.max(0, Math.floor(position)), Math.max(0, maxPosition));
}

function findNearestWall(
  pointer: { x: number; y: number },
  walls: TeacherCardDragWallRect[],
) {
  let nearest: TeacherCardDragWallRect | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const wall of walls) {
    const x = clamp(pointer.x, wall.rect.left, wall.rect.right);
    const y = clamp(pointer.y, wall.rect.top, wall.rect.bottom);
    const distance = Math.hypot(pointer.x - x, pointer.y - y);
    if (distance < nearestDistance) {
      nearest = wall;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculateEdgeDelta({
  pointer,
  start,
  end,
  edgePx,
  maxPerFrame,
}: {
  pointer: number;
  start: number;
  end: number;
  edgePx: number;
  maxPerFrame: number;
}) {
  if (edgePx <= 0 || maxPerFrame <= 0 || end <= start) return 0;
  const distanceToStart = pointer - start;
  const distanceToEnd = end - pointer;

  if (distanceToStart >= 0 && distanceToStart <= edgePx) {
    const pressure = clamp((edgePx - distanceToStart) / edgePx, 0, 1);
    return -(pressure * pressure * maxPerFrame);
  }
  if (distanceToEnd >= 0 && distanceToEnd <= edgePx) {
    const pressure = clamp((edgePx - distanceToEnd) / edgePx, 0, 1);
    return pressure * pressure * maxPerFrame;
  }
  return 0;
}
