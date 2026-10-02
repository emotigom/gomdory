"use client";

import { useEffect } from "react";

type StyleSnapshot = {
  bodyCssText: string;
  documentElementCssText: string;
  scrollY: number;
  modalScrollLockedAttribute: string | null;
};

type BoardScrollerSnapshot = {
  element: HTMLElement;
  cssText: string;
  scrollTop: number;
  scrollLeft: number;
};

const BOARD_SCROLLER_SELECTOR = '[data-scroll="board-main"], [data-scroll="dashboard-board"], [data-testid="student-board-scroll-surface"]';
const MODAL_SCROLL_CONTAINER_SELECTOR = '[data-modal-scroll-container="true"]';

let lockCount = 0;
let snapshot: StyleSnapshot | null = null;
let boardScrollerSnapshots: BoardScrollerSnapshot[] = [];
let boardScrollerRefreshFrame: number | null = null;

const lockBoardScrollers = () => {
  const known = new Set(boardScrollerSnapshots.map(({ element }) => element));
  document.querySelectorAll<HTMLElement>(BOARD_SCROLLER_SELECTOR).forEach((element) => {
    if (known.has(element) || element.closest(MODAL_SCROLL_CONTAINER_SELECTOR)) return;
    boardScrollerSnapshots.push({
      element,
      cssText: element.style.cssText,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    });
    element.style.overflow = "hidden";
    element.style.overscrollBehavior = "none";
    element.style.touchAction = "none";
  });
};

function lockDocumentScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (lockCount++ > 0) return;

  const body = document.body;
  const root = document.documentElement;
  const scrollY = window.scrollY;
  snapshot = {
    bodyCssText: body.style.cssText,
    documentElementCssText: root.style.cssText,
    scrollY,
    modalScrollLockedAttribute: root.getAttribute("data-modal-scroll-locked"),
  };
  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);

  root.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  root.dataset.modalScrollLocked = "true";
  lockBoardScrollers();
  boardScrollerRefreshFrame = window.requestAnimationFrame(() => {
    boardScrollerRefreshFrame = null;
    if (lockCount > 0) lockBoardScrollers();
  });
}

function unlockDocumentScroll() {
  if (typeof window === "undefined" || typeof document === "undefined" || lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0 || !snapshot) return;

  const saved = snapshot;
  snapshot = null;
  if (boardScrollerRefreshFrame !== null) {
    window.cancelAnimationFrame(boardScrollerRefreshFrame);
    boardScrollerRefreshFrame = null;
  }
  boardScrollerSnapshots.forEach(({ element, cssText, scrollTop, scrollLeft }) => {
    element.style.cssText = cssText;
    element.scrollTop = scrollTop;
    element.scrollLeft = scrollLeft;
  });
  boardScrollerSnapshots = [];
  document.body.style.cssText = saved.bodyCssText;
  document.documentElement.style.cssText = saved.documentElementCssText;
  if (saved.modalScrollLockedAttribute === null) document.documentElement.removeAttribute("data-modal-scroll-locked");
  else document.documentElement.setAttribute("data-modal-scroll-locked", saved.modalScrollLockedAttribute);
  window.scrollTo(0, saved.scrollY);
}

/** Locks background scrolling while one or more portal modals are open. */
export function useModalScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, [active]);
}

export const __modalScrollLockForTests = {
  get count() { return lockCount; },
};
