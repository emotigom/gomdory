const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const computeNextScrollLeft = ({
  current,
  direction,
  delta,
  max,
}: {
  current: number;
  direction: -1 | 0 | 1;
  delta: number;
  max: number;
}) => {
  if (direction === 0 || delta <= 0 || max <= 0) return current;
  return clamp(current + direction * delta, 0, max);
};

export const computeEdgeScrollDelta = ({
  pointer,
  rect,
  axis,
  zonePx,
  maxSpeedPxPerFrame,
}: {
  pointer: number;
  rect: Pick<DOMRect, "left" | "right" | "top" | "bottom">;
  axis: "x" | "y";
  zonePx: number;
  maxSpeedPxPerFrame: number;
}) => {
  if (zonePx <= 0 || maxSpeedPxPerFrame <= 0) return 0;

  const start = axis === "x" ? rect.left : rect.top;
  const end = axis === "x" ? rect.right : rect.bottom;
  const distanceToStart = pointer - start;
  const distanceToEnd = end - pointer;

  if (distanceToStart >= 0 && distanceToStart <= zonePx) {
    const t = clamp((zonePx - distanceToStart) / zonePx, 0, 1);
    return -(t * t * maxSpeedPxPerFrame);
  }
  if (distanceToEnd >= 0 && distanceToEnd <= zonePx) {
    const t = clamp((zonePx - distanceToEnd) / zonePx, 0, 1);
    return t * t * maxSpeedPxPerFrame;
  }
  return 0;
};

export const computeClampedScroll = ({
  current,
  delta,
  max,
}: {
  current: number;
  delta: number;
  max: number;
}) => clamp(current + delta, 0, Math.max(0, max));

export const shouldContinueAutoScrollLoop = ({
  deltaX,
  deltaY,
  movedX,
  movedY,
}: {
  deltaX: number;
  deltaY: number;
  movedX: boolean;
  movedY: boolean;
}) => {
  const activeX = Math.abs(deltaX) > 0.01 && movedX;
  const activeY = Math.abs(deltaY) > 0.01 && movedY;
  return activeX || activeY;
};
