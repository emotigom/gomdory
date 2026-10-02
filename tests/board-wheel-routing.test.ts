import test from "node:test";
import assert from "node:assert/strict";

import {
  canScrollY,
  canScrollForDeltaY,
  findBoardScroller,
  resolveBoardScroller,
  findScrollableAncestorForDeltaY,
  handleBoardBackgroundWheelFallback,
  handleDocumentWheelFallbackForBoard,
  isModalScrollLocked,
  isWheelFromModal,
  isAtBottom,
  isAtTop,
  isWheelFromBoardEmptySurface,
  isWheelFromColumnHeader,
  isWheelFromWallColumn,
  resolveWheelFallbackScroller,
  shouldHandoffWheelToBoard,
} from "@/lib/board/wheelRouting";

test("shouldHandoffWheelToBoard handoffs only at column boundaries", () => {
  assert.equal(
    shouldHandoffWheelToBoard({ canScroll: true, atTop: false, atBottom: false, deltaY: 20 }),
    false,
  );
  assert.equal(
    shouldHandoffWheelToBoard({ canScroll: true, atTop: false, atBottom: true, deltaY: 20 }),
    true,
  );
  assert.equal(
    shouldHandoffWheelToBoard({ canScroll: true, atTop: true, atBottom: false, deltaY: -20 }),
    true,
  );
  assert.equal(
    shouldHandoffWheelToBoard({ canScroll: false, atTop: true, atBottom: true, deltaY: 20 }),
    false,
  );
});

test("canScrollY / boundary helpers respect epsilon", () => {
  const flat = { scrollTop: 0, clientHeight: 240, scrollHeight: 241 } as const;
  const overflowing = { scrollTop: 0, clientHeight: 240, scrollHeight: 242 } as const;
  const bottom = { scrollTop: 42, clientHeight: 200, scrollHeight: 242 } as const;

  assert.equal(canScrollY(flat), false);
  assert.equal(canScrollY(overflowing), true);
  assert.equal(isAtTop(overflowing), true);
  assert.equal(isAtBottom(bottom), true);
});

test("canScrollForDeltaY requires real movement room in the wheel direction", () => {
  const middle = { scrollTop: 50, clientHeight: 200, scrollHeight: 500 } as const;
  const top = { scrollTop: 0, clientHeight: 200, scrollHeight: 500 } as const;
  const bottom = { scrollTop: 300, clientHeight: 200, scrollHeight: 500 } as const;

  assert.equal(canScrollForDeltaY(middle, 30), true);
  assert.equal(canScrollForDeltaY(middle, -30), true);
  assert.equal(canScrollForDeltaY(top, -30), false);
  assert.equal(canScrollForDeltaY(bottom, 30), false);
});

test("findBoardScroller returns board-main and falls back to dashboard-board", () => {
  const boardMain = { id: "main" };
  const dashboardBoard = { id: "legacy" };

  const rootWithMain = {
    querySelector: (selector: string) => {
      assert.equal(selector, '[data-scroll="board-main"], [data-scroll="dashboard-board"]');
      return boardMain;
    },
  } as unknown as ParentNode;
  const rootLegacy = {
    querySelector: () => dashboardBoard,
  } as unknown as ParentNode;
  const rootMissing = {
    querySelector: () => null,
  } as unknown as ParentNode;

  assert.equal(findBoardScroller(rootWithMain), boardMain as unknown as HTMLElement);
  assert.equal(findBoardScroller(rootLegacy), dashboardBoard as unknown as HTMLElement);
  assert.equal(findBoardScroller(rootMissing), null);
});



test("resolveBoardScroller returns board-main when it already overflows", () => {
  const boardMain = {
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 400,
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    querySelectorAll: () => [],
    parentElement: null,
  } as unknown as HTMLElement;

  assert.equal(resolveBoardScroller(boardMain), boardMain);
});

test("resolveBoardScroller finds nearest non-column overflow descendant when board-main is flat", () => {
  const columnScrollBody = {
    dataset: { columnScrollBody: "true", scroll: "wall-column" },
    scrollLeft: 0,
    scrollWidth: 1200,
    clientWidth: 500,
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 500,
  } as unknown as HTMLElement;
  const descendant = {
    dataset: { boardScrollSurface: "true" },
    scrollLeft: 0,
    scrollWidth: 1200,
    clientWidth: 500,
    scrollTop: 0,
    scrollHeight: 500,
    clientHeight: 500,
  } as unknown as HTMLElement;

  const boardMain = {
    scrollLeft: 0,
    scrollWidth: 500,
    clientWidth: 500,
    scrollTop: 0,
    scrollHeight: 500,
    clientHeight: 500,
    querySelectorAll: () => [columnScrollBody, descendant],
    parentElement: null,
  } as unknown as HTMLElement;

  assert.equal(resolveBoardScroller(boardMain), descendant);
});

test("findScrollableAncestorForDeltaY prefers board-main when it can scroll", () => {
  const boardMain = {
    scrollTop: 10,
    scrollHeight: 1000,
    clientHeight: 400,
  } as HTMLElement;
  const parent = {
    scrollTop: 10,
    scrollHeight: 800,
    clientHeight: 300,
    parentElement: boardMain,
  } as HTMLElement;
  const column = {
    parentElement: parent,
    closest: (selector: string) => {
      assert.equal(selector, '[data-scroll="board-main"], [data-scroll="dashboard-board"]');
      return boardMain;
    },
  } as unknown as HTMLElement;

  assert.equal(findScrollableAncestorForDeltaY(column, 40), boardMain);
});

test("findScrollableAncestorForDeltaY returns null when no ancestor can scroll for delta", () => {
  const stuckParent = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    parentElement: null,
  } as HTMLElement;
  const boardMainAtBottom = {
    scrollTop: 500,
    scrollHeight: 900,
    clientHeight: 400,
  } as HTMLElement;
  const column = {
    parentElement: stuckParent,
    closest: () => boardMainAtBottom,
  } as unknown as HTMLElement;

  assert.equal(findScrollableAncestorForDeltaY(column, 30), null);
});


test("resolveWheelFallbackScroller only runs when startEl is the wall-column scroll container", () => {
  const boardMain = {
    scrollTop: 10,
    scrollHeight: 1000,
    clientHeight: 400,
  } as HTMLElement;
  const plainParent = {
    scrollTop: 20,
    scrollHeight: 900,
    clientHeight: 300,
    parentElement: boardMain,
  } as HTMLElement;

  const nonContainer = {
    dataset: {},
    parentElement: plainParent,
    closest: () => boardMain,
  } as unknown as HTMLElement;

  const container = {
    dataset: { scroll: "wall-column", wallId: "w1" },
    parentElement: plainParent,
    closest: () => boardMain,
  } as unknown as HTMLElement;

  assert.equal(resolveWheelFallbackScroller(nonContainer, 30), null);
  assert.equal(resolveWheelFallbackScroller(container, 30), boardMain);
});

test("dead-end fallback returns null so callers must not preventDefault", () => {
  const column = {
    dataset: { scroll: "wall-column", wallId: "w1" },
    parentElement: null,
    closest: () => null,
  } as unknown as HTMLElement;

  const fallback = resolveWheelFallbackScroller(column, 20);
  assert.equal(fallback, null);
  const shouldPreventDefault = fallback !== null;
  assert.equal(shouldPreventDefault, false);
});


test("isWheelFromWallColumn only treats column scroll body ancestry as column wheel", () => {
  const insideColumnHeader = {
    closest: (selector: string) => {
      assert.equal(selector, '[data-column-scroll-body="true"]');
      return null;
    },
  } as unknown as Element;

  const insideColumnScrollBody = {
    closest: (selector: string) => {
      assert.equal(selector, '[data-column-scroll-body="true"]');
      return { dataset: { columnScrollBody: "true" } };
    },
  } as unknown as Element;

  const outsideColumn = {
    closest: () => null,
  } as unknown as Element;

  assert.equal(isWheelFromWallColumn(insideColumnHeader), false);
  assert.equal(isWheelFromWallColumn(insideColumnScrollBody), true);
  assert.equal(isWheelFromWallColumn(outsideColumn), false);
  assert.equal(isWheelFromWallColumn(null), false);
});

test("wheel routing markers distinguish column headers and board empty surface", () => {
  const columnHeader = {
    closest: (selector: string) => selector === '[data-column-header="true"]' ? {} : null,
  } as unknown as Element;
  const boardSurface = {
    closest: (selector: string) => selector === '[data-board-scroll-surface="true"]' ? {} : null,
  } as unknown as Element;

  assert.equal(isWheelFromColumnHeader(columnHeader), true);
  assert.equal(isWheelFromColumnHeader(boardSurface), false);
  assert.equal(isWheelFromBoardEmptySurface(boardSurface), true);
  assert.equal(isWheelFromBoardEmptySurface(columnHeader), false);
});

test("handleBoardBackgroundWheelFallback is no-op when background wheel has no horizontal room", () => {
  let prevented = false;
  const board = {
    scrollTop: 10,
    scrollHeight: 900,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 400,
    clientWidth: 400,
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: true,
    deltaY: 25,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleBoardBackgroundWheelFallback(board, wheelEvent);
  assert.equal(handled, false);
  assert.equal(board.scrollTop, 10);
  assert.equal(board.scrollLeft, 40);
  assert.equal(prevented, false);
});

test("handleBoardBackgroundWheelFallback maps deltaY to horizontal when vertical is unavailable", () => {
  let prevented = false;
  const board = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: true,
    deltaY: 30,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleBoardBackgroundWheelFallback(board, wheelEvent);
  assert.equal(handled, true);
  assert.equal(board.scrollLeft, 70);
  assert.equal(prevented, true);
});





test("handleBoardBackgroundWheelFallback scrolls resolved descendant scroller", () => {
  let prevented = false;
  const realScroller = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
  } as unknown as HTMLElement;

  const boardMain = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 0,
    scrollWidth: 300,
    clientWidth: 300,
    querySelectorAll: () => [realScroller],
    parentElement: null,
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: true,
    deltaY: 30,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleBoardBackgroundWheelFallback(boardMain, wheelEvent);
  assert.equal(handled, true);
  assert.equal(realScroller.scrollLeft, 70);
  assert.equal(prevented, true);
});

test("handleBoardBackgroundWheelFallback handles cancelable:false when board can move", () => {
  let prevented = false;
  const realScroller = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
  } as unknown as HTMLElement;

  const boardMain = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 0,
    scrollWidth: 300,
    clientWidth: 300,
    querySelectorAll: () => [realScroller],
    parentElement: null,
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: false,
    deltaY: 30,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleBoardBackgroundWheelFallback(boardMain, wheelEvent);
  assert.equal(handled, true);
  assert.equal(realScroller.scrollLeft, 70);
  assert.equal(prevented, false);
});

test("handleBoardBackgroundWheelFallback is no-op for wall-column wheel events", () => {
  let prevented = false;
  const board = {
    scrollTop: 100,
    scrollHeight: 1000,
    clientHeight: 300,
    scrollLeft: 20,
    scrollWidth: 900,
    clientWidth: 400,
  } as unknown as HTMLElement;

  const wheelEvent = {
    deltaY: 20,
    target: { closest: () => ({ dataset: { columnScrollBody: "true" } }) },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleBoardBackgroundWheelFallback(board, wheelEvent);
  assert.equal(handled, false);
  assert.equal(board.scrollTop, 100);
  assert.equal(board.scrollLeft, 20);
  assert.equal(prevented, false);
});

test("handleBoardBackgroundWheelFallback does not preventDefault when board cannot move", () => {
  let prevented = false;
  const board = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 800,
    scrollWidth: 1200,
    clientWidth: 400,
  } as unknown as HTMLElement;

  const wheelEvent = {
    deltaY: 20,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleBoardBackgroundWheelFallback(board, wheelEvent);
  assert.equal(handled, false);
  assert.equal(board.scrollTop, 0);
  assert.equal(board.scrollLeft, 800);
  assert.equal(prevented, false);
});


test("handleDocumentWheelFallbackForBoard routes wheel when event is inside board rect but outside board path", () => {
  let prevented = false;
  const board = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: true,
    defaultPrevented: false,
    composedPath: () => [document.body],
    clientX: 300,
    clientY: 200,
    deltaY: 30,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleDocumentWheelFallbackForBoard(board, wheelEvent);
  assert.equal(handled, true);
  assert.equal(board.scrollLeft, 70);
  assert.equal(prevented, true);
});



test("handleDocumentWheelFallbackForBoard routes non-cancelable wheel events without preventDefault", () => {
  let prevented = false;
  const board = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: false,
    defaultPrevented: false,
    composedPath: () => [document.body],
    clientX: 300,
    clientY: 200,
    deltaY: 30,
    target: { closest: () => null },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as WheelEvent;

  const handled = handleDocumentWheelFallbackForBoard(board, wheelEvent);
  assert.equal(handled, true);
  assert.equal(board.scrollLeft, 70);
  assert.equal(prevented, false);
});

test("handleDocumentWheelFallbackForBoard is noop when event path already includes board", () => {
  const board = {
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 300,
    scrollLeft: 0,
    scrollWidth: 1200,
    clientWidth: 400,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
  } as unknown as HTMLElement;

  const wheelEvent = {
    cancelable: true,
    defaultPrevented: false,
    composedPath: () => [board, document.body],
    clientX: 300,
    clientY: 200,
    deltaY: 30,
    target: { closest: () => null },
    preventDefault: () => undefined,
  } as unknown as WheelEvent;

  const handled = handleDocumentWheelFallbackForBoard(board, wheelEvent);
  assert.equal(handled, false);
});

test("handleDocumentWheelFallbackForBoard ignores a modal wheel even when its coordinates overlap the board", () => {
  const modalContent = {
    closest: (selector: string) => selector === '[data-modal-scroll-root="true"]' ? {} : null,
  };
  const board = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
  } as unknown as HTMLElement;
  const wheelEvent = {
    cancelable: true,
    defaultPrevented: false,
    composedPath: () => [modalContent, document.body],
    clientX: 300,
    clientY: 200,
    deltaY: 30,
    target: modalContent,
    preventDefault: () => undefined,
  } as unknown as WheelEvent;

  assert.equal(isWheelFromModal(wheelEvent), true);
  assert.equal(handleDocumentWheelFallbackForBoard(board, wheelEvent), false);
  assert.equal(board.scrollLeft, 40);
});

test("handleDocumentWheelFallbackForBoard ignores wheel while a modal scroll lock is active and resumes after close", () => {
  const board = {
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    scrollLeft: 40,
    scrollWidth: 1200,
    clientWidth: 400,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
  } as unknown as HTMLElement;
  const wheelEvent = () => ({
    cancelable: true,
    defaultPrevented: false,
    composedPath: () => [document.body],
    clientX: 300,
    clientY: 200,
    deltaY: 30,
    target: document.body,
    preventDefault: () => undefined,
  } as unknown as WheelEvent);

  const mockDocument = document as unknown as { documentElement?: { dataset: Record<string, string | undefined> } };
  const previousDocumentElement = mockDocument.documentElement;
  mockDocument.documentElement = { dataset: { modalScrollLocked: "true" } };
  assert.equal(isModalScrollLocked(), true);
  assert.equal(handleDocumentWheelFallbackForBoard(board, wheelEvent()), false);
  assert.equal(board.scrollLeft, 40);

  mockDocument.documentElement = { dataset: {} };
  assert.equal(isModalScrollLocked(), false);
  assert.equal(handleDocumentWheelFallbackForBoard(board, wheelEvent()), true);
  assert.equal(board.scrollLeft, 70);
  mockDocument.documentElement = previousDocumentElement;
});
