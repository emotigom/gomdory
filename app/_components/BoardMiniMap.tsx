"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { UiMinimapMode } from "@/lib/data/boards";
import FloatingPortal from "@/app/_components/FloatingPortal";
import { warnIfNotViewportFixed } from "@/lib/ui/fixedGuard";
import {
  computeCanvasSize,
  ensurePointerEventsPolicy,
  computeMinimapBounds,
  mapMinimapPointToWorldPoint,
  mapWorldRectToMinimapRect,
  shouldRedrawMinimapFromMutations,
} from "@/lib/ui/minimap";
import { createRafCoalescer } from "@/lib/ui/rafCoalescer";

export type BoardMiniMapProps = {
  mode: UiMinimapMode;
  scrollRef: React.RefObject<HTMLElement | null>;
  columns?: Array<{
    id: string;
    widthPx: number;
    cardCount: number;
  }>;
  columnCount?: number;
};

type MinimapWorldItem = { x: number; y: number; width: number; height: number; type: "section" | "card" };


const PANEL_STYLE: React.CSSProperties = {
  width: "min(360px, calc(100vw - 2rem))",
  height: "min(240px, 28vh)",
};

const policy = ensurePointerEventsPolicy();
const MINIMAP_CANVAS_PADDING = 8;
const HOVER_CLOSE_DELAY_MS = 180;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isFinitePositive = (value: number) => Number.isFinite(value) && value > 0;

export default function BoardMiniMap({ mode, scrollRef, columnCount }: BoardMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const columnMeasureCacheRef = useRef<{ key: string; snapshots: MinimapWorldItem[] } | null>(null);
  const measurementFrameRef = useRef<number | null>(null);
  const coalescerRef = useRef<ReturnType<typeof createRafCoalescer> | null>(null);
  const dragActiveRef = useRef(false);
  const dragFrameRef = useRef<number | null>(null);
  const dragPointRef = useRef<{ canvas: HTMLCanvasElement; clientX: number; clientY: number } | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const panelId = "board-minimap-panel";

  const panelOpen = useMemo(() => {
    if (mode === "always") return true;
    if (toggleOpen) return true;
    if (mode === "toggle") return false;
    if (mode === "hover") return hoverOpen;
    return false;
  }, [hoverOpen, mode, toggleOpen]);

  const measureItemsFromDom = useCallback((): MinimapWorldItem[] => {
    const container = scrollRef.current;
    if (!container) return [];
    const containerRect = container.getBoundingClientRect();
    if (!isFinitePositive(containerRect.width) || !isFinitePositive(containerRect.height)) return [];
    const toWorldRect = (node: HTMLElement): MinimapWorldItem | null => {
      const rect = node.getBoundingClientRect();
      if (!Number.isFinite(rect.left + rect.top + rect.width + rect.height)) return null;
      return {
        x: rect.left - containerRect.left + container.scrollLeft,
        y: rect.top - containerRect.top + container.scrollTop,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        type: node.dataset.cardId ? "card" : "section",
      };
    };
    const sections = Array.from(container.querySelectorAll<HTMLElement>('[data-scroll="wall-column"][data-wall-id]'))
      .map(toWorldRect)
      .filter((item): item is MinimapWorldItem => item !== null);
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-card-id]"))
      .map(toWorldRect)
      .filter((item): item is MinimapWorldItem => item !== null);
    return [...sections, ...cards];
  }, [scrollRef]);

  const getMemoizedColumnsFromDom = useCallback((): MinimapWorldItem[] => {
    const container = scrollRef.current;
    if (!container) return [];
    const key = `${container.scrollLeft}:${container.clientWidth}:${container.scrollWidth}:${container.childElementCount}`;
    const cached = columnMeasureCacheRef.current;
    if (cached?.key === key) {
      return cached.snapshots;
    }
    const measured = measureItemsFromDom();
    columnMeasureCacheRef.current = { key, snapshots: measured };
    return measured;
  }, [measureItemsFromDom, scrollRef]);

  const getWorldItems = useCallback(
    (container: HTMLElement): MinimapWorldItem[] => {
      const domItems = getMemoizedColumnsFromDom();
      const fallbackColumnCount = Math.max(1, columnCount ?? 1);
      const fallbackItems = Array.from({ length: fallbackColumnCount }, (_, index) => ({
        x: index * 320,
        y: 0,
        width: 300,
        height: Math.max(320, container.clientHeight * 0.8),
        type: "section" as const,
      }));
      return domItems.length > 0 ? domItems : fallbackItems;
    },
    [columnCount, getMemoizedColumnsFromDom],
  );

  const scheduleDraw = useCallback(() => {
    if (!coalescerRef.current) {
      coalescerRef.current = createRafCoalescer(() => {
        const canvas = canvasRef.current;
        const container = scrollRef.current;
        if (!canvas || !container) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const size = computeCanvasSize({ cssWidth: rect.width, cssHeight: rect.height, dpr: window.devicePixelRatio || 1 });
        if (canvas.width !== size.pixelWidth || canvas.height !== size.pixelHeight) {
          canvas.width = size.pixelWidth;
          canvas.height = size.pixelHeight;
        }

        context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        context.clearRect(0, 0, size.cssWidth, size.cssHeight);
        context.fillStyle = "#f8fafc";
        context.fillRect(0, 0, size.cssWidth, size.cssHeight);

        const worldItems = getWorldItems(container);
        const bounds = computeMinimapBounds(worldItems, 24);

        for (const item of worldItems) {
          const mapped = mapWorldRectToMinimapRect({ rect: item, bounds, miniWidth: size.cssWidth, miniHeight: size.cssHeight, padding: MINIMAP_CANVAS_PADDING });
          context.fillStyle = item.type === "card" ? "#64748b" : "#cbd5e1";
          context.fillRect(mapped.x, mapped.y, mapped.width, mapped.height);
        }

        const viewportWorld = { x: container.scrollLeft, y: container.scrollTop, width: container.clientWidth, height: container.clientHeight };
        const mappedViewport = mapWorldRectToMinimapRect({
          rect: viewportWorld,
          bounds,
          miniWidth: size.cssWidth,
          miniHeight: size.cssHeight,
          padding: MINIMAP_CANVAS_PADDING,
        });
        const viewX = clamp(mappedViewport.x, 0, size.cssWidth);
        const viewY = clamp(mappedViewport.y, 0, size.cssHeight);
        const viewW = Math.max(8, clamp(mappedViewport.width, 0, size.cssWidth));
        const viewH = Math.max(8, clamp(mappedViewport.height, 0, size.cssHeight));
        context.fillStyle = "rgba(59, 130, 246, 0.2)";
        context.strokeStyle = "rgba(59, 130, 246, 0.8)";
        context.lineWidth = 2;
        context.fillRect(viewX, viewY, viewW, viewH);
        context.strokeRect(viewX, viewY, viewW, viewH);
      }, window.requestAnimationFrame);
    }

    if (!coalescerRef.current.schedule()) return;
  }, [getWorldItems, scrollRef]);

  const scrollToMinimapPoint = useCallback(
    (input: { canvas: HTMLCanvasElement; clientX: number; clientY: number }) => {
      const container = scrollRef.current;
      if (!container) return;
      const rect = input.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const bounds = computeMinimapBounds(getWorldItems(container), 24);
      const worldPoint = mapMinimapPointToWorldPoint({
        x: input.clientX - rect.left,
        y: input.clientY - rect.top,
        bounds,
        miniWidth: rect.width,
        miniHeight: rect.height,
        padding: MINIMAP_CANVAS_PADDING,
      });
      const maxLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
      const maxTop = Math.max(container.scrollHeight - container.clientHeight, 0);
      const left = clamp(worldPoint.x - container.clientWidth / 2, 0, maxLeft);
      const top = clamp(worldPoint.y - container.clientHeight / 2, 0, maxTop);
      container.scrollTo({ left, top, behavior: "auto" });
    },
    [getWorldItems, scrollRef],
  );

  const schedulePointerScroll = useCallback(
    (input: { canvas: HTMLCanvasElement; clientX: number; clientY: number }) => {
      dragPointRef.current = input;
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const point = dragPointRef.current;
        if (!point) return;
        scrollToMinimapPoint(point);
        scheduleDraw();
      });
    },
    [scheduleDraw, scrollToMinimapPoint],
  );

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current === null) return;
    window.clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  }, []);

  const openHoverPanel = useCallback(() => {
    if (mode !== "hover") return;
    clearHoverCloseTimer();
    setHoverOpen(true);
  }, [clearHoverCloseTimer, mode]);

  const scheduleHoverClose = useCallback(() => {
    if (mode !== "hover" || toggleOpen) return;
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      if (rootRef.current?.contains(document.activeElement)) return;
      setHoverOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearHoverCloseTimer, mode, toggleOpen]);

  useEffect(() => {
    if (!panelOpen || mode === "hidden") return;
    const container = scrollRef.current;
    const handleTick = () => scheduleDraw();

    handleTick();
    container?.addEventListener("scroll", handleTick, { passive: true });
    window.addEventListener("resize", handleTick);

    const canvasObserver = new ResizeObserver(handleTick);
    if (canvasRef.current) {
      canvasObserver.observe(canvasRef.current);
    }

    const scheduleRemeasure = () => {
      if (measurementFrameRef.current !== null) return;
      measurementFrameRef.current = window.requestAnimationFrame(() => {
        measurementFrameRef.current = null;
        columnMeasureCacheRef.current = null;
        handleTick();
      });
    };
    const filteredMutationObserver = new MutationObserver((records) => {
      const shouldRedraw = shouldRedrawMinimapFromMutations(
        records.map((record) => ({
          type: record.type,
          targetDataset: record.target instanceof HTMLElement ? record.target.dataset : undefined,
          addedDatasets: Array.from(record.addedNodes).map((node) => (node instanceof HTMLElement ? node.dataset : undefined)),
          removedDatasets: Array.from(record.removedNodes).map((node) => (node instanceof HTMLElement ? node.dataset : undefined)),
        })),
      );
      if (!shouldRedraw) return;
      scheduleRemeasure();
    });
    const itemResizeObserver = new ResizeObserver(() => scheduleRemeasure());
    if (container) {
      filteredMutationObserver.observe(container, { childList: true, subtree: true, attributes: false });
      for (const node of container.querySelectorAll<HTMLElement>('[data-scroll="wall-column"][data-wall-id], [data-card-id]')) {
        itemResizeObserver.observe(node);
      }
    }

    return () => {
      container?.removeEventListener("scroll", handleTick);
      window.removeEventListener("resize", handleTick);
      canvasObserver.disconnect();
      filteredMutationObserver.disconnect();
      itemResizeObserver.disconnect();
      if (measurementFrameRef.current !== null) {
        window.cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
    };
  }, [mode, panelOpen, scheduleDraw, scrollRef]);

  useEffect(() => () => {
    coalescerRef.current?.cancel(window.cancelAnimationFrame);
    clearHoverCloseTimer();
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
  }, [clearHoverCloseTimer]);

  useEffect(() => {
    if (!rootRef.current) return;
    warnIfNotViewportFixed(rootRef.current, "BoardMiniMap");
  }, []);

  useEffect(() => {
    if (!toggleOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setToggleOpen(false);
      setHoverOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleOpen]);


  useEffect(() => {
    if (!toggleOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setToggleOpen(false);
      setHoverOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [toggleOpen]);
  if (mode === "hidden") {
    return null;
  }

  return (
    <FloatingPortal>
      <div
        ref={rootRef}
        data-floating="minimap"
        className="fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex flex-col items-start transition-transform data-[avoid-overlap=true]:-translate-y-12"
        style={{ pointerEvents: policy.rootPointerEvents }}
      >
        <div
          data-testid="board-minimap-shell"
          className="relative flex flex-col items-start gap-2"
          style={{ pointerEvents: policy.panelPointerEvents }}
          onPointerEnter={openHoverPanel}
          onPointerLeave={scheduleHoverClose}
        >
          {panelOpen ? (
            <div
              id={panelId}
              ref={panelRef}
              data-testid="board-minimap-panel"
              className="max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-2 shadow-lg"
              style={{ ...PANEL_STYLE, pointerEvents: policy.panelPointerEvents }}
            >
              <canvas
                data-testid="board-minimap-viewport"
                ref={canvasRef}
                className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dragActiveRef.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  schedulePointerScroll({ canvas: event.currentTarget, clientX: event.clientX, clientY: event.clientY });
                }}
                onPointerMove={(event) => {
                  if (!dragActiveRef.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  schedulePointerScroll({ canvas: event.currentTarget, clientX: event.clientX, clientY: event.clientY });
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dragActiveRef.current = false;
                  dragPointRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onPointerCancel={(event) => {
                  dragActiveRef.current = false;
                  dragPointRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
              />
            </div>
          ) : null}

          {panelOpen ? <div aria-hidden="true" data-testid="board-minimap-hover-bridge" className="absolute bottom-11 left-0 h-2 w-11" /> : null}

          <button
            data-testid="board-minimap-trigger"
            type="button"
            onClick={() => {
              if (mode === "always") return;
              setToggleOpen((prev) => {
                const next = !prev;
                if (next) {
                  clearHoverCloseTimer();
                  setHoverOpen(true);
                } else if (mode !== "hover") {
                  setHoverOpen(false);
                }
                return next;
              });
            }}
            aria-expanded={panelOpen}
            aria-controls={panelOpen ? panelId : undefined}
            aria-pressed={mode === "toggle" ? toggleOpen : undefined}
            aria-label="미니맵"
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface)] text-lg text-[var(--theme-text)] shadow-md transition hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-card)]"
            style={{ pointerEvents: policy.buttonPointerEvents }}
          >
            ▦
          </button>
        </div>
      </div>
    </FloatingPortal>
  );
}
