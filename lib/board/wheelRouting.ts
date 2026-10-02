const SCROLL_EPSILON = 1;
const COLUMN_SCROLL_BODY_SELECTOR = '[data-column-scroll-body="true"]';
const COLUMN_HEADER_SELECTOR = '[data-column-header="true"]';
const BOARD_EMPTY_SURFACE_SELECTOR = '[data-board-scroll-surface="true"]';
const MODAL_SCROLL_ROOT_SELECTOR = '[data-modal-scroll-root="true"]';

type ScrollMetrics = Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">;
type HorizontalScrollMetrics = Pick<HTMLElement, "scrollLeft" | "scrollWidth" | "clientWidth">;
type ElementWithParent = HTMLElement & { parentElement: HTMLElement | null };

export const canScrollY = (element: ScrollMetrics) => element.scrollHeight > element.clientHeight + SCROLL_EPSILON;

export const isAtTop = (element: ScrollMetrics) => element.scrollTop <= 0;

export const isAtBottom = (element: ScrollMetrics) =>
  element.scrollTop + element.clientHeight >= element.scrollHeight - SCROLL_EPSILON;

export const canScrollForDeltaY = (element: ScrollMetrics, deltaY: number) => {
  if (!canScrollY(element)) return false;
  if (deltaY < 0) return !isAtTop(element);
  if (deltaY > 0) return !isAtBottom(element);
  return false;
};

export const shouldHandoffWheelToBoard = ({
  canScroll,
  atTop,
  atBottom,
  deltaY,
}: {
  canScroll: boolean;
  atTop: boolean;
  atBottom: boolean;
  deltaY: number;
}) => {
  if (!canScroll) return false;
  if (deltaY < 0) return atTop;
  if (deltaY > 0) return atBottom;
  return false;
};

export const findBoardScroller = (root: ParentNode = document) =>
  root.querySelector<HTMLElement>('[data-scroll="board-main"], [data-scroll="dashboard-board"]');

const hasScrollableOverflow = (element: HorizontalScrollMetrics & ScrollMetrics) =>
  element.scrollWidth > element.clientWidth + SCROLL_EPSILON ||
  element.scrollHeight > element.clientHeight + SCROLL_EPSILON;

const hasScrollableOverflowStyle = (element: HTMLElement) => {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return true;
  const style = window.getComputedStyle(element);
  const allowsX = style.overflowX === "auto" || style.overflowX === "scroll";
  const allowsY = style.overflowY === "auto" || style.overflowY === "scroll";
  return allowsX || allowsY;
};

const isColumnScrollBodyElement = (element: HTMLElement) =>
  element.dataset?.columnScrollBody === "true" || element.dataset?.scroll === "wall-column";

const isBoardScrollSurfaceElement = (element: HTMLElement) =>
  element.dataset?.boardScrollSurface === "true" ||
  element.dataset?.scroll === "board-main" ||
  element.dataset?.scroll === "dashboard-board";

const isBoardScrollerCandidate = (element: HTMLElement) =>
  !isColumnScrollBodyElement(element) && (isBoardScrollSurfaceElement(element) || hasScrollableOverflow(element));

export const resolveBoardScroller = (boardMainEl: HTMLElement): HTMLElement => {
  if (hasScrollableOverflow(boardMainEl) && hasScrollableOverflowStyle(boardMainEl)) {
    return boardMainEl;
  }

  const descendants = boardMainEl.querySelectorAll<HTMLElement>("*");
  for (const candidate of descendants) {
    if (isBoardScrollerCandidate(candidate) && hasScrollableOverflow(candidate) && hasScrollableOverflowStyle(candidate)) {
      return candidate;
    }
  }

  let current: HTMLElement | null = boardMainEl.parentElement;
  let depth = 0;
  while (current && depth < 6) {
    if (hasScrollableOverflow(current) && hasScrollableOverflowStyle(current)) {
      return current;
    }
    current = current.parentElement;
    depth += 1;
  }

  return boardMainEl;
};

const clampScroll = (next: number, max: number) => Math.min(Math.max(next, 0), Math.max(max, 0));

const canScrollX = (element: HorizontalScrollMetrics) =>
  element.scrollWidth > element.clientWidth + SCROLL_EPSILON;

const canScrollForDeltaX = (element: HorizontalScrollMetrics, deltaX: number) => {
  if (!canScrollX(element)) return false;
  if (deltaX < 0) return element.scrollLeft > 0;
  if (deltaX > 0) return element.scrollLeft + element.clientWidth < element.scrollWidth - SCROLL_EPSILON;
  return false;
};

const getElementFromEventTarget = (target: EventTarget | null): Element | null => {
  if (!target || typeof (target as { closest?: unknown }).closest !== "function") return null;
  if (typeof Element === "undefined") return target as Element;
  return target instanceof Element ? target : null;
};

export const isWheelFromWallColumn = (target: EventTarget | null): boolean => {
  const element = getElementFromEventTarget(target);
  if (!element) return false;
  return Boolean(element.closest(COLUMN_SCROLL_BODY_SELECTOR));
};

export const isWheelFromColumnHeader = (target: EventTarget | null): boolean => {
  const element = getElementFromEventTarget(target);
  if (!element) return false;
  return Boolean(element.closest(COLUMN_HEADER_SELECTOR));
};

export const isWheelFromBoardEmptySurface = (target: EventTarget | null): boolean => {
  const element = getElementFromEventTarget(target);
  if (!element) return false;
  return Boolean(element.closest(BOARD_EMPTY_SURFACE_SELECTOR));
};

const isModalScrollRoot = (value: EventTarget | null): boolean => {
  const element = getElementFromEventTarget(value);
  if (element?.closest(MODAL_SCROLL_ROOT_SELECTOR)) return true;
  return Boolean(
    value
    && typeof (value as { matches?: unknown }).matches === "function"
    && (value as Element).matches(MODAL_SCROLL_ROOT_SELECTOR),
  );
};

/** True when a wheel event originated in a portal modal, including a shadow-DOM composed path. */
export const isWheelFromModal = (event: Pick<WheelEvent, "target" | "composedPath">): boolean => {
  if (isModalScrollRoot(event.target)) return true;
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path.some((entry) => isModalScrollRoot(entry));
};

export const isModalScrollLocked = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement?.dataset?.modalScrollLocked === "true";
};

export const handleBoardBackgroundWheelFallback = (boardMainEl: HTMLElement, e: WheelEvent): boolean => {
  if (isWheelFromWallColumn(e.target)) return false;

  const boardEl = resolveBoardScroller(boardMainEl);

  const preventDefaultIfAllowed = () => {
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const fallbackDeltaX = e.deltaY;
  if (canScrollForDeltaX(boardEl, fallbackDeltaX)) {
    const prevLeft = boardEl.scrollLeft;
    boardEl.scrollLeft = clampScroll(prevLeft + fallbackDeltaX, boardEl.scrollWidth - boardEl.clientWidth);
    if (boardEl.scrollLeft !== prevLeft) {
      preventDefaultIfAllowed();
      return true;
    }
  }

  return false;
};

const isEventWithinBoardRect = (boardEl: HTMLElement, event: WheelEvent) => {
  const rect = boardEl.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
};

export const handleDocumentWheelFallbackForBoard = (boardMainEl: HTMLElement, e: WheelEvent): boolean => {
  // This runs at document capture, before modal handlers can stop propagation.
  if (e.defaultPrevented || isModalScrollLocked() || isWheelFromModal(e)) return false;

  const boardEl = resolveBoardScroller(boardMainEl);

  const path = typeof e.composedPath === "function" ? e.composedPath() : [];
  if (path.includes(boardMainEl) || path.includes(boardEl)) return false;
  if (!isEventWithinBoardRect(boardEl, e)) return false;

  return handleBoardBackgroundWheelFallback(boardMainEl, e);
};

export const isWallColumnScrollContainer = (element: HTMLElement | null) =>
  element?.dataset.scroll === "wall-column";

const findBoardMainFromStart = (startEl: HTMLElement) =>
  startEl.closest<HTMLElement>('[data-scroll="board-main"], [data-scroll="dashboard-board"]');

const isPotentialScrollableContainer = (element: HTMLElement) => {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return true;
  const style = window.getComputedStyle(element);
  return style.overflowY === "auto" || style.overflowY === "scroll";
};

export const findScrollableAncestorForDeltaY = (
  startEl: HTMLElement | null,
  deltaY: number,
  maxDepth = 6,
): HTMLElement | null => {
  if (!startEl) return null;

  const boardMain = findBoardMainFromStart(startEl);
  if (boardMain && boardMain !== startEl && canScrollForDeltaY(boardMain, deltaY)) {
    return boardMain;
  }

  let depth = 0;
  let current = startEl.parentElement as ElementWithParent | null;
  while (current && depth < maxDepth) {
    if (current !== boardMain && isPotentialScrollableContainer(current) && canScrollForDeltaY(current, deltaY)) {
      return current;
    }
    current = current.parentElement;
    depth += 1;
  }

  return null;
};

export const resolveWheelFallbackScroller = (startEl: HTMLElement | null, deltaY: number) => {
  if (!isWallColumnScrollContainer(startEl)) return null;
  return findScrollableAncestorForDeltaY(startEl, deltaY);
};
