"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import PawIcon from "../icons/PawIcon";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  storageKey: string;
  minLeftPx: number;
  minRightPx: number;
  defaultLeftPx?: number;
  defaultRatio?: number;
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function SplitPane({
  left,
  right,
  storageKey,
  minLeftPx,
  minRightPx,
  defaultLeftPx,
  defaultRatio = 0.5,
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftWidthRef = useRef<number | null>(null);
  const containerWidthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const [containerWidth, setContainerWidth] = useState(0);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);

  const maxLeftWidth = useMemo(() => {
    return Math.max(minLeftPx, containerWidth - minRightPx);
  }, [containerWidth, minLeftPx, minRightPx]);

  const minLeftWidth = minLeftPx;

  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const width = node.getBoundingClientRect().width;
      containerWidthRef.current = width;
      setContainerWidth(width);
      setLeftWidth((prev) => {
        if (prev === null) return prev;
        return clamp(prev, minLeftPx, Math.max(minLeftPx, width - minRightPx));
      });
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [minLeftPx, minRightPx]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? Number.parseFloat(stored) : Number.NaN;
    const width = node.getBoundingClientRect().width;
    const initial = Number.isFinite(parsed)
      ? parsed
      : defaultLeftPx ?? width * (defaultRatio ?? 0.5);
    const clamped = clamp(initial, minLeftPx, Math.max(minLeftPx, width - minRightPx));
    setLeftWidth(clamped);
  }, [defaultLeftPx, defaultRatio, minLeftPx, minRightPx, storageKey]);

  useEffect(() => {
    if (leftWidth === null) return;
    window.localStorage.setItem(storageKey, `${Math.round(leftWidth)}`);
  }, [leftWidth, storageKey]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const scheduleWidth = (nextWidth: number) => {
    pendingWidthRef.current = nextWidth;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingWidthRef.current === null) return;
      setLeftWidth(pendingWidthRef.current);
    });
  };

  const updateFromPointer = (clientX: number) => {
    const node = containerRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const raw = clientX - bounds.left;
    const minLeft = minLeftPx;
    const maxLeft = Math.max(minLeftPx, bounds.width - minRightPx);
    scheduleWidth(clamp(raw, minLeft, maxLeft));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    updateFromPointer(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromPointer(event.clientX);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.shiftKey ? 80 : 24;
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const current = leftWidthRef.current ?? minLeftPx;
    const maxLeft = Math.max(minLeftPx, containerWidthRef.current - minRightPx);
    scheduleWidth(clamp(current + delta * direction, minLeftPx, maxLeft));
  };

  return (
    <div ref={containerRef} className={`flex min-h-0 w-full ${className ?? ""}`}>
      <div className="min-h-0 shrink-0" style={{ width: leftWidth ?? undefined }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={minLeftWidth}
        aria-valuemax={maxLeftWidth}
        aria-valuenow={leftWidth ?? minLeftWidth}
        aria-label="Resize panels"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onKeyDown={handleKeyDown}
        className="group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center rounded-full transition-colors hover:bg-slate-100/80 focus-visible:outline-none"
      >
        <div className="absolute inset-y-3 w-px bg-slate-200 transition-colors group-hover:bg-slate-300" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-transparent transition group-hover:bg-slate-50 group-hover:text-slate-700 group-hover:ring-slate-200 group-focus-visible:ring-slate-300">
          <PawIcon className="h-5 w-5 block" />
        </div>
      </div>
      <div className="min-h-0 flex-1">{right}</div>
    </div>
  );
}
