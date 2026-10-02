"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/app/_components/uiTokens";

type HoverExpandBarProps = {
  collapsedContent: React.ReactNode;
  expandedContent: React.ReactNode;
  activationMode?: "hover" | "click";
  align?: "start" | "center" | "end" | "between";
  heightCollapsed?: number;
  /** @deprecated Expanded panels now auto-size to content. Use panelMaxWidth for compact dropdown width. */
  heightExpanded?: number;
  panelMaxWidth?: string;
  rootClassName?: string;
  collapsedClassName?: string;
  toggleClassName?: string;
  panelContainerClassName?: string;
  panelClassName?: string;
  /** @deprecated Use activationMode="click" to disable hover expansion. */
  openOnHover?: boolean;
  rootTestId?: string;
  collapsedTestId?: string;
  toggleTestId?: string;
  expandedTestId?: string;
};

const alignClasses: Record<NonNullable<HoverExpandBarProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

export default function HoverExpandBar({
  collapsedContent,
  expandedContent,
  activationMode,
  align = "between",
  heightCollapsed = 28,
  panelMaxWidth = "min(1120px, calc(100vw - 24px))",
  rootClassName,
  collapsedClassName,
  toggleClassName,
  panelContainerClassName,
  panelClassName,
  openOnHover = true,
  rootTestId = "hover-expand-bar",
  collapsedTestId,
  toggleTestId,
  expandedTestId = "hover-expand-panel",
}: HoverExpandBarProps) {
  const resolvedActivationMode = activationMode ?? (openOnHover ? "hover" : "click");
  const [openMode, setOpenMode] = useState<"closed" | "hover" | "pinned">("closed");
  const [focused, setFocused] = useState(false);
  const [canOpenOnHover, setCanOpenOnHover] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const closeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const heightStyle = useMemo(
    () =>
      ({
        "--bar-collapsed": `${heightCollapsed}px`,
        "--bar-panel-max-width": panelMaxWidth,
      }) as React.CSSProperties,
    [heightCollapsed, panelMaxWidth],
  );

  const expanded = openMode !== "closed" || (resolvedActivationMode === "hover" && focused);

  useEffect(() => {
    if (resolvedActivationMode !== "hover" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setCanOpenOnHover(false);
      return;
    }
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncCanHover = () => setCanOpenOnHover(media.matches);
    syncCanHover();
    media.addEventListener?.("change", syncCanHover);
    return () => {
      media.removeEventListener?.("change", syncCanHover);
    };
  }, [resolvedActivationMode]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeSoon = () => {
    if (resolvedActivationMode !== "hover") return;
    if (openMode === "pinned") return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      if (panelRef.current?.contains(document.activeElement)) return;
      setOpenMode("closed");
      closeTimerRef.current = null;
    }, 220);
  };

  const openHover = () => {
    if (resolvedActivationMode !== "hover") return;
    if (!canOpenOnHover) return;
    clearCloseTimer();
    setOpenMode((prev) => (prev === "pinned" ? prev : "hover"));
  };

  const closeAll = useCallback(() => {
    clearCloseTimer();
    setOpenMode("closed");
    setFocused(false);
  }, [clearCloseTimer]);

  const recomputePanelPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const horizontalMargin = 12;
    const maxWidth = Math.min(rect.width, window.innerWidth - horizontalMargin * 2);
    const left = Math.max(horizontalMargin, Math.min(rect.left, window.innerWidth - maxWidth - horizontalMargin));
    const top = Math.round(rect.bottom + 2);
    setPanelStyle({ left: `${left}px`, top: `${top}px`, width: `${maxWidth}px`, maxHeight: "min(65vh, calc(100vh - 24px))" });
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.target || !(event.target instanceof Node)) return;
      const insideRoot = rootRef.current?.contains(event.target);
      const insidePanel = panelRef.current?.contains(event.target);
      if (!insideRoot && !insidePanel) {
        closeAll();
      }
    };
    const onReposition = () => {
      if (expanded) recomputePanelPosition();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [closeAll, expanded, recomputePanelPosition]);

  useEffect(() => {
    if (expanded) recomputePanelPosition();
  }, [expanded, recomputePanelPosition]);

  return (
    <div
      ref={rootRef}
      data-testid={rootTestId}
      data-expanded={expanded ? "true" : "false"}
      className={cn("group relative h-[var(--bar-collapsed)] overflow-visible", rootClassName)}
      style={heightStyle}
      onMouseEnter={() => {
        openHover();
      }}
      onMouseLeave={closeSoon}
      onFocusCapture={() => {
        clearCloseTimer();
        if (resolvedActivationMode === "hover") {
          setFocused(true);
          setOpenMode((prev) => (prev === "closed" ? "hover" : prev));
        }
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        const insidePanel = Boolean(nextTarget && panelRef.current?.contains(nextTarget));
        if (!nextTarget || (!event.currentTarget.contains(nextTarget) && !insidePanel)) {
          setFocused(false);
          closeSoon();
        }
      }}
    >
      <div
        data-testid={collapsedTestId}
        onClick={() => {
          if (resolvedActivationMode !== "click") return;
          clearCloseTimer();
          setOpenMode((prev) => (prev === "closed" ? "pinned" : "closed"));
        }}
        className={cn(
          "flex h-[var(--bar-collapsed)] items-center px-4 text-xs font-semibold uppercase tracking-wide",
          resolvedActivationMode === "click" && "cursor-pointer",
          alignClasses[align],
          collapsedClassName,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center">{collapsedContent}</div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            clearCloseTimer();
            setOpenMode((prev) => (prev === "closed" ? "pinned" : "closed"));
          }}
          data-testid={toggleTestId}
          className={cn("ml-3 flex h-7 w-7 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", toggleClassName)}
          aria-expanded={expanded}
          aria-label="상단바 펼치기/접기"
          title="상단바 펼치기/접기"
        >
          <span aria-hidden className="text-base leading-none">
            {expanded ? "▴" : "▾"}
          </span>
        </button>
      </div>
      {expanded && typeof document !== "undefined"
        ? createPortal(
            <div
              data-testid={expandedTestId}
              ref={panelRef}
              aria-hidden={!expanded}
              style={panelStyle}
              className={cn(
                "pointer-events-none fixed z-[1100] flex justify-center bg-transparent transition-[opacity,transform] duration-200 ease-out",
                expanded ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
                panelContainerClassName,
              )}
              onFocusCapture={() => {
                clearCloseTimer();
                setFocused(true);
              }}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                const insideRoot = Boolean(nextTarget && rootRef.current?.contains(nextTarget));
                if (!nextTarget || (!event.currentTarget.contains(nextTarget) && !insideRoot)) {
                  setFocused(false);
                  closeSoon();
                }
              }}
            >
              <div
                className={cn(
                  "pointer-events-auto flex h-auto w-full max-w-[var(--bar-panel-max-width)] items-center overflow-y-auto rounded-2xl px-4 py-3 text-xs font-medium shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1",
                  panelClassName,
                )}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={closeSoon}
              >
                {expandedContent}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
