export type AxisViewportMetrics = {
  scrollOffset: number;
  scrollSize: number;
  clientSize: number;
};

export type ViewportRectRatios = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CanvasSize = {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
};

export type MinimapMutationRecordLike = {
  type: "childList" | "attributes" | "characterData";
  targetDataset?: Record<string, string | undefined>;
  addedDatasets?: Array<Record<string, string | undefined> | undefined>;
  removedDatasets?: Array<Record<string, string | undefined> | undefined>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calcAxisViewportRatio({ scrollOffset, scrollSize, clientSize }: AxisViewportMetrics): {
  start: number;
  size: number;
} {
  const safeScrollSize = Math.max(scrollSize, 1);
  const safeClientSize = clamp(clientSize, 0, safeScrollSize);
  const maxOffset = Math.max(safeScrollSize - safeClientSize, 0);
  const safeOffset = clamp(scrollOffset, 0, maxOffset);

  const start = maxOffset <= 0 ? 0 : safeOffset / maxOffset;
  const size = safeScrollSize <= 0 ? 1 : clamp(safeClientSize / safeScrollSize, 0, 1);

  return { start, size };
}

export function calcViewportRectRatios(input: {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}): ViewportRectRatios {
  const horizontal = calcAxisViewportRatio({
    scrollOffset: input.scrollLeft,
    scrollSize: input.scrollWidth,
    clientSize: input.clientWidth,
  });
  const vertical = calcAxisViewportRatio({
    scrollOffset: input.scrollTop,
    scrollSize: input.scrollHeight,
    clientSize: input.clientHeight,
  });

  return {
    left: horizontal.start,
    top: vertical.start,
    width: horizontal.size,
    height: vertical.size,
  };
}

export function mapMinimapPointToScroll(input: {
  ratioX: number;
  ratioY: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}): { left: number; top: number } {
  const maxLeft = Math.max(input.scrollWidth - input.clientWidth, 0);
  const maxTop = Math.max(input.scrollHeight - input.clientHeight, 0);

  return {
    left: clamp(input.ratioX, 0, 1) * maxLeft,
    top: clamp(input.ratioY, 0, 1) * maxTop,
  };
}

export function computeCanvasSize(input: { cssWidth: number; cssHeight: number; dpr?: number }): CanvasSize {
  const cssWidth = Math.max(1, Math.floor(input.cssWidth));
  const cssHeight = Math.max(1, Math.floor(input.cssHeight));
  const dpr = Math.max(1, input.dpr ?? 1);

  return {
    cssWidth,
    cssHeight,
    dpr,
    pixelWidth: Math.max(1, Math.floor(cssWidth * dpr)),
    pixelHeight: Math.max(1, Math.floor(cssHeight * dpr)),
  };
}

export function ensurePointerEventsPolicy(): {
  rootPointerEvents: "none";
  panelPointerEvents: "auto";
  buttonPointerEvents: "auto";
  overlayPointerEvents: "none";
} {
  return {
    rootPointerEvents: "none",
    panelPointerEvents: "auto",
    buttonPointerEvents: "auto",
    overlayPointerEvents: "none",
  };
}

function isWallColumnDataset(dataset?: Record<string, string | undefined>): boolean {
  return dataset?.scroll === "wall-column" && Boolean(dataset.wallId);
}

function isCardDataset(dataset?: Record<string, string | undefined>): boolean {
  return Boolean(dataset?.cardId);
}

export function shouldRedrawMinimapFromMutations(records: ReadonlyArray<MinimapMutationRecordLike>): boolean {
  for (const record of records) {
    if (record.type !== "childList") {
      continue;
    }

    if (isWallColumnDataset(record.targetDataset) || isCardDataset(record.targetDataset)) {
      return true;
    }

    const added = record.addedDatasets ?? [];
    const removed = record.removedDatasets ?? [];
    if (added.some((dataset) => isWallColumnDataset(dataset) || isCardDataset(dataset))) {
      return true;
    }
    if (removed.some((dataset) => isWallColumnDataset(dataset) || isCardDataset(dataset))) {
      return true;
    }
  }
  return false;
}


export type MinimapWorldRect = { x: number; y: number; width: number; height: number; type?: "section" | "card" };
export type MinimapBounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };

const DEFAULT_MINIMAP_BOUNDS: MinimapBounds = { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };

export function computeMinimapBounds(items: ReadonlyArray<MinimapWorldRect>, padding = 0): MinimapBounds {
  if (items.length === 0) return DEFAULT_MINIMAP_BOUNDS;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const width = Number.isFinite(item.width) ? Math.max(1, item.width) : 1;
    const height = Number.isFinite(item.height) ? Math.max(1, item.height) : 1;
    const x = Number.isFinite(item.x) ? item.x : 0;
    const y = Number.isFinite(item.y) ? item.y : 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  if (!Number.isFinite(minX + minY + maxX + maxY)) return DEFAULT_MINIMAP_BOUNDS;
  const safePadding = Math.max(0, padding);
  minX -= safePadding;
  minY -= safePadding;
  maxX += safePadding;
  maxY += safePadding;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return { minX, minY, maxX, maxY, width, height };
}

export function mapWorldRectToMinimapRect(input: {
  rect: MinimapWorldRect;
  bounds: MinimapBounds;
  miniWidth: number;
  miniHeight: number;
  padding: number;
}): { x: number; y: number; width: number; height: number; scale: number } {
  const innerWidth = Math.max(1, input.miniWidth - input.padding * 2);
  const innerHeight = Math.max(1, input.miniHeight - input.padding * 2);
  const scale = Math.min(innerWidth / Math.max(1, input.bounds.width), innerHeight / Math.max(1, input.bounds.height));
  const x = (input.rect.x - input.bounds.minX) * scale + input.padding;
  const y = (input.rect.y - input.bounds.minY) * scale + input.padding;
  const width = Math.max(1, input.rect.width * scale);
  const height = Math.max(1, input.rect.height * scale);
  return { x, y, width, height, scale };
}

export function mapMinimapPointToWorldPoint(input: {
  x: number;
  y: number;
  bounds: MinimapBounds;
  miniWidth: number;
  miniHeight: number;
  padding: number;
}): { x: number; y: number } {
  const innerWidth = Math.max(1, input.miniWidth - input.padding * 2);
  const innerHeight = Math.max(1, input.miniHeight - input.padding * 2);
  const scale = Math.min(innerWidth / Math.max(1, input.bounds.width), innerHeight / Math.max(1, input.bounds.height));
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const maxX = input.padding + input.bounds.width * safeScale;
  const maxY = input.padding + input.bounds.height * safeScale;
  const miniX = clamp(Number.isFinite(input.x) ? input.x : input.padding, input.padding, maxX);
  const miniY = clamp(Number.isFinite(input.y) ? input.y : input.padding, input.padding, maxY);

  return {
    x: input.bounds.minX + (miniX - input.padding) / safeScale,
    y: input.bounds.minY + (miniY - input.padding) / safeScale,
  };
}
