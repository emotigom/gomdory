"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

type ResizableSplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  storageKey?: string;
  className?: string;
};

const DEFAULT_LEFT_PERCENT = 60;
const DEFAULT_MIN_LEFT_PERCENT = 40;
const DEFAULT_MAX_LEFT_PERCENT = 75;
const KEYBOARD_STEP_PERCENT = 2;
const KEYBOARD_LARGE_STEP_PERCENT = 10;
const SEPARATOR_LABEL = "편집기와 결과 창 크기 조절";

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export default function ResizableSplitPane({
  left,
  right,
  defaultLeftPercent = DEFAULT_LEFT_PERCENT,
  minLeftPercent = DEFAULT_MIN_LEFT_PERCENT,
  maxLeftPercent = DEFAULT_MAX_LEFT_PERCENT,
  storageKey,
  className = "",
}: ResizableSplitPaneProps) {
  const min = Math.min(minLeftPercent, maxLeftPercent);
  const max = Math.max(minLeftPercent, maxLeftPercent);
  const defaultPercent = clampPercent(defaultLeftPercent, min, max);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPercent, setLeftPercent] = useState(defaultPercent);
  const [dragging, setDragging] = useState(false);
  const [storageReady, setStorageReady] = useState(!storageKey);

  const updateLeftPercent = useCallback(
    (nextValue: number) => {
      setLeftPercent(clampPercent(nextValue, min, max));
    },
    [max, min],
  );

  useEffect(() => {
    if (!storageKey) {
      setStorageReady(true);
      return;
    }
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue) {
        const parsedValue = Number(storedValue);
        if (Number.isFinite(parsedValue)) {
          updateLeftPercent(parsedValue);
        }
      }
    } catch {
      // Layout preference is optional and local-only; ignore blocked storage.
    } finally {
      setStorageReady(true);
    }
  }, [storageKey, updateLeftPercent]);

  useEffect(() => {
    if (!storageKey || !storageReady) return;
    try {
      window.localStorage.setItem(storageKey, String(leftPercent));
    } catch {
      // Layout preference is optional and local-only; ignore blocked storage.
    }
  }, [leftPercent, storageKey, storageReady]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nextValue = ((clientX - rect.left) / rect.width) * 100;
      updateLeftPercent(nextValue);
    },
    [updateLeftPercent],
  );

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateFromClientX(event.clientX);
  };

  useEffect(() => {
    if (!dragging) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onPointerMove = (event: globalThis.PointerEvent) => {
      event.preventDefault();
      updateFromClientX(event.clientX);
    };
    const stopDragging = () => setDragging(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [dragging, updateFromClientX]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? KEYBOARD_LARGE_STEP_PERCENT : KEYBOARD_STEP_PERCENT;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateLeftPercent(leftPercent - step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      updateLeftPercent(leftPercent + step);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateLeftPercent(min);
    } else if (event.key === "End") {
      event.preventDefault();
      updateLeftPercent(max);
    } else if (event.key === "Enter") {
      event.preventDefault();
      updateLeftPercent(defaultPercent);
    }
  };

  const resetToDefault = () => updateLeftPercent(defaultPercent);
  const splitStyle = {
    "--resizable-split-left": `${leftPercent}%`,
  } as CSSProperties & Record<"--resizable-split-left", string>;

  return (
    <div
      ref={containerRef}
      className={`grid min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-clip lg:gap-0 lg:[grid-template-columns:minmax(360px,var(--resizable-split-left))_16px_minmax(320px,1fr)] ${className}`}
      style={splitStyle}
      data-testid="resizable-split-pane"
    >
      <div className="min-w-0 overflow-hidden" data-testid="resizable-split-pane-left">
        {left}
      </div>
      <button
        type="button"
        role="separator"
        aria-label={SEPARATOR_LABEL}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={leftPercent}
        title="드래그해서 창 크기를 조절하세요"
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={resetToDefault}
        className={`group hidden min-h-full w-4 cursor-col-resize touch-none items-stretch justify-center rounded-full outline-none transition lg:flex ${dragging ? "bg-[var(--theme-surface-muted)]" : "hover:bg-[var(--theme-surface-muted)] focus-visible:bg-[var(--theme-surface-muted)]"}`}
        data-testid="resizable-split-pane-separator"
      >
        <span className="my-2 block w-0.5 rounded-full bg-[var(--theme-border)] transition group-hover:bg-[var(--theme-accent-strong)] group-focus-visible:bg-[var(--theme-accent-strong)]" />
      </button>
      <div className="min-w-0 overflow-hidden" data-testid="resizable-split-pane-right">
        {right}
      </div>
    </div>
  );
}
