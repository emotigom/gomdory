"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTouchLike } from "@/lib/ui/isTouchLike";

import { getInsertionIndex, moveItem } from "./reorderUtils";

type DragState = {
  activeId: string | null;
  armedId: string | null;
  indicatorIndex: number | null;
  isDragging: boolean;
};

type UseReorderListOptions<T extends { id: string }> = {
  items: T[];
  enabled: boolean;
  onReorder?: (previous: T[], next: T[]) => void;
};

export default function useReorderList<T extends { id: string }>({
  items,
  enabled,
  onReorder,
}: UseReorderListOptions<T>) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const pendingTargetRef = useRef<HTMLElement | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const rafRef = useRef<number | null>(null);
  const pendingIndicatorRef = useRef<number | null>(null);
  const { touchLike } = useTouchLike();

  const isDragging = Boolean(activeId);

  const dragState = useMemo<DragState>(
    () => ({
      activeId,
      armedId,
      indicatorIndex,
      isDragging,
    }),
    [activeId, armedId, indicatorIndex, isDragging],
  );

  const registerItem = useCallback(
    (id: string) => (node: HTMLLIElement | null) => {
      if (node) {
        itemRefs.current.set(id, node);
      } else {
        itemRefs.current.delete(id);
      }
    },
    [],
  );

  const cancelDrag = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingIndicatorRef.current = null;
    setActiveId(null);
    setArmedId(null);
    setIndicatorIndex(null);
    pointerIdRef.current = null;
    pendingIdRef.current = null;
    pendingTargetRef.current = null;
    pendingPointRef.current = null;
  }, []);

  const scheduleIndicatorUpdate = useCallback((nextIndex: number | null) => {
    pendingIndicatorRef.current = nextIndex;
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setIndicatorIndex(pendingIndicatorRef.current);
    });
  }, []);

  const getHandleProps = useCallback(
    (id: string) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const handleTarget = (event.target as HTMLElement | null)?.closest("[data-drag-handle]");
        if (!handleTarget) {
          return;
        }
        if (!enabled) {
          return;
        }
        const isTouchPointer = event.pointerType === "touch" || touchLike;
        if (!isTouchPointer) {
          event.preventDefault();
          event.stopPropagation();
          pointerIdRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          setActiveId(id);
          const rectForId = (cardId: string) => itemRefs.current.get(cardId)?.getBoundingClientRect() ?? null;
          scheduleIndicatorUpdate(getInsertionIndex(orderedItems, rectForId, event.clientY));
          return;
        }

        event.stopPropagation();
        pendingIdRef.current = id;
        pendingTargetRef.current = event.currentTarget;
        pendingPointRef.current = { x: event.clientX, y: event.clientY };
        pointerIdRef.current = event.pointerId;

        const clearPending = () => {
          if (pendingTimerRef.current !== null) {
            window.clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
          }
          pendingIdRef.current = null;
          pendingTargetRef.current = null;
          pendingPointRef.current = null;
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          window.removeEventListener("pointercancel", handlePointerUp);
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
          if (pointerIdRef.current !== null && moveEvent.pointerId !== pointerIdRef.current) {
            return;
          }
          const start = pendingPointRef.current;
          if (!start) return;
          const dx = Math.abs(moveEvent.clientX - start.x);
          const dy = Math.abs(moveEvent.clientY - start.y);
          if (dx > 5 || dy > 5) {
            clearPending();
          }
        };

        const handlePointerUp = (upEvent: PointerEvent) => {
          if (pointerIdRef.current !== null && upEvent.pointerId !== pointerIdRef.current) {
            return;
          }
          clearPending();
        };

        pendingTimerRef.current = window.setTimeout(() => {
          const pendingId = pendingIdRef.current;
          const target = pendingTargetRef.current;
          if (!pendingId || !target) {
            clearPending();
            return;
          }
          setArmedId(pendingId);
          target.setPointerCapture(event.pointerId);
          setActiveId(pendingId);
          const rectForId = (cardId: string) => itemRefs.current.get(cardId)?.getBoundingClientRect() ?? null;
          scheduleIndicatorUpdate(getInsertionIndex(orderedItems, rectForId, event.clientY));
          clearPending();
        }, 260);

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
      },
    }),
    [enabled, orderedItems, scheduleIndicatorUpdate, touchLike],
  );

  useEffect(() => {
    if (!activeId) {
      setOrderedItems(items);
    }
  }, [activeId, items]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled && activeId) {
      cancelDrag();
    }
  }, [activeId, cancelDrag, enabled]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }
      const rectForId = (cardId: string) => itemRefs.current.get(cardId)?.getBoundingClientRect() ?? null;
      const nextIndex = getInsertionIndex(orderedItems, rectForId, event.clientY);
      scheduleIndicatorUpdate(nextIndex);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }
      const fromIndex = orderedItems.findIndex((item) => item.id === activeId);
      if (fromIndex === -1) {
        cancelDrag();
        return;
      }
      const insertionIndex = indicatorIndex ?? fromIndex;
      let toIndex = insertionIndex;
      if (toIndex > fromIndex) {
        toIndex -= 1;
      }
      if (toIndex !== fromIndex) {
        const next = moveItem(orderedItems, fromIndex, toIndex);
        setOrderedItems(next);
        onReorder?.(orderedItems, next);
      }
      cancelDrag();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelDrag();
      }
    };

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.body.style.userSelect = previousUserSelect;
    };
  }, [activeId, cancelDrag, indicatorIndex, onReorder, orderedItems, scheduleIndicatorUpdate]);

  return {
    items: orderedItems,
    setItems: setOrderedItems,
    containerRef,
    registerItem,
    getHandleProps,
    dragState,
    cancelDrag,
  };
}
