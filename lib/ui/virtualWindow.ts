export type ComputeWindowInput = {
  itemCount: number;
  itemHeightEstimate: number;
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
  includeIndex?: number | null;
};

export type VirtualWindow = {
  start: number;
  end: number;
  topSpacer: number;
  bottomSpacer: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function computeWindow({
  itemCount,
  itemHeightEstimate,
  scrollTop,
  viewportHeight,
  overscan,
  includeIndex = null,
}: ComputeWindowInput): VirtualWindow {
  const safeCount = Math.max(0, Math.floor(itemCount));
  if (safeCount === 0) {
    return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };
  }

  const rowHeight = Math.max(1, itemHeightEstimate);
  const safeOverscan = Math.max(0, Math.floor(overscan));
  const safeScrollTop = Math.max(0, scrollTop);
  const safeViewportHeight = Math.max(0, viewportHeight);

  const firstVisible = Math.floor(safeScrollTop / rowHeight);
  const lastVisible = Math.max(firstVisible, Math.ceil((safeScrollTop + safeViewportHeight) / rowHeight) - 1);

  let start = clamp(firstVisible - safeOverscan, 0, safeCount - 1);
  let end = clamp(lastVisible + safeOverscan + 1, start + 1, safeCount);

  if (includeIndex !== null && Number.isInteger(includeIndex) && includeIndex >= 0 && includeIndex < safeCount) {
    if (includeIndex < start) {
      start = includeIndex;
    }
    if (includeIndex >= end) {
      end = includeIndex + 1;
    }
  }

  return {
    start,
    end,
    topSpacer: start * rowHeight,
    bottomSpacer: Math.max(0, (safeCount - end) * rowHeight),
  };
}
