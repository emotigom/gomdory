"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type RightSidebarCoachProps = {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
};

const RIGHT_SIDEBAR_LABEL = "AI 코치";
const COACH_MIN_WIDTH_PX = 480;
const COACH_MAX_WIDTH_PX = 640;

export default function RightSidebarCoach({
  children,
  className,
  defaultOpen = false,
  onOpenChange,
  label = RIGHT_SIDEBAR_LABEL,
}: RightSidebarCoachProps) {
  const [isPinnedOpen, setIsPinnedOpen] = useState(defaultOpen);
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobileQuery = window.matchMedia("(max-width: 1023px)");
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => {
      setIsMobile(mobileQuery.matches);
      setHoverEnabled(hoverQuery.matches);
    };
    update();
    mobileQuery.addEventListener("change", update);
    hoverQuery.addEventListener("change", update);
    return () => {
      mobileQuery.removeEventListener("change", update);
      hoverQuery.removeEventListener("change", update);
    };
  }, []);

  const isOpen = isPinnedOpen || (hoverEnabled && isHoveredOpen);

  const setPinnedOpen = useCallback(
    (nextOpen: boolean) => {
      setIsPinnedOpen(nextOpen);
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setIsHoveredOpen(false);
      }
    },
    [onOpenChange],
  );

  const handleToggle = useCallback(() => {
    setPinnedOpen(!isPinnedOpen);
  }, [isPinnedOpen, setPinnedOpen]);

  const handleMouseEnter = useCallback(() => {
    if (!hoverEnabled || isPinnedOpen) return;
    setIsHoveredOpen(true);
  }, [hoverEnabled, isPinnedOpen]);

  const handleMouseLeave = useCallback(() => {
    if (!hoverEnabled || isPinnedOpen) return;
    setIsHoveredOpen(false);
  }, [hoverEnabled, isPinnedOpen]);

  const containerClasses = useMemo(() => {
    const widthClass = isOpen ? "w-auto" : "w-12";
    return [
      "fixed inset-y-0 right-0 z-40 flex flex-col overflow-hidden border border-slate-200/70 bg-white/95 shadow-lg transition-all duration-300 ease-out",
      "lg:static lg:h-full lg:rounded-2xl lg:shadow-sm",
      widthClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");
  }, [className, isOpen]);

  const openStyles = useMemo<CSSProperties | undefined>(() => {
    if (!isOpen) return undefined;
    if (isMobile) {
      return {
        width: "100vw",
        maxWidth: "100vw",
      };
    }
    return {
      minWidth: COACH_MIN_WIDTH_PX,
      width: `clamp(${COACH_MIN_WIDTH_PX}px, 32vw, ${COACH_MAX_WIDTH_PX}px)`,
      maxWidth: COACH_MAX_WIDTH_PX,
    };
  }, [isMobile, isOpen]);

  return (
    <>
      {isOpen && isMobile ? (
        <button
          type="button"
          aria-label={`${label} 닫기`}
          onClick={() => setPinnedOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40"
        />
      ) : null}
      <aside
        className={containerClasses}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={label}
        style={openStyles}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-2 py-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls="edu-coach-panel"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <span aria-hidden="true">{isOpen ? "⮜" : "🤖"}</span>
            <span className="sr-only">{isOpen ? `${label} 닫기` : `${label} 열기`}</span>
          </button>
          <span
            className={`text-xs font-semibold text-slate-600 transition-opacity duration-200 ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {label}
          </span>
          <div className={`w-6 ${isOpen ? "opacity-0" : "opacity-100"}`} aria-hidden="true" />
        </div>
        <div
          id="edu-coach-panel"
          className={`min-h-0 flex-1 transition-opacity duration-200 ${
            isOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
