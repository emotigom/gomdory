export const MIN_WALL_WIDTH = 240;
export const DEFAULT_WALL_WIDTH = 360;
export const RESIZE_STEPS = [240, 300, 360, 420, 480, 560, 640, 720, 840, 960] as const;

export const MAX_WALL_WIDTH = RESIZE_STEPS[RESIZE_STEPS.length - 1];

export function clampWallWidth(width: number): number {
  return Math.min(Math.max(MIN_WALL_WIDTH, width), MAX_WALL_WIDTH);
}

export function snapWallWidth(width: number, isSnapEnabled = true): number {
  const clampedWidth = clampWallWidth(width);
  if (!isSnapEnabled) return clampedWidth;

  return RESIZE_STEPS.reduce((closest, step) => {
    return Math.abs(step - clampedWidth) < Math.abs(closest - clampedWidth) ? step : closest;
  }, RESIZE_STEPS[0]);
}

export function getAdjacentWallWidth(currentWidth: number, direction: "left" | "right"): number {
  const snappedWidth = snapWallWidth(currentWidth);
  const currentStepIndex = RESIZE_STEPS.findIndex((step) => step === snappedWidth);
  if (currentStepIndex < 0) return snappedWidth;

  const nextIndex =
    direction === "right"
      ? Math.min(currentStepIndex + 1, RESIZE_STEPS.length - 1)
      : Math.max(currentStepIndex - 1, 0);
  return RESIZE_STEPS[nextIndex];
}
