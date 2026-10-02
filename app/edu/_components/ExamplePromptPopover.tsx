"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

type ExamplePromptPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  prompts: string[];
  isTeacherMode: boolean;
  onSelect: (prompt: string) => void;
  onClose: () => void;
  align?: "left" | "right";
};

type PopoverStyle = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function ExamplePromptPopover({
  open,
  anchorRef,
  prompts,
  isTeacherMode,
  onSelect,
  onClose,
  align = "left",
}: ExamplePromptPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [style, setStyle] = useState<PopoverStyle | null>(null);

  const updatePosition = useCallback(() => {
    if (!open || typeof window === "undefined") return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const padding = 12;
    const width = Math.min(300, viewportWidth - padding * 2);
    const popoverHeight = popoverRef.current?.offsetHeight ?? 0;
    const aboveTop = rect.top - popoverHeight - 8;
    const belowTop = rect.bottom + 8;
    const maxHeight = Math.min(360, viewportHeight - padding * 2);
    const prefersAbove = aboveTop >= padding;
    const top = clamp(
      prefersAbove ? aboveTop : Math.min(viewportHeight - padding - popoverHeight, belowTop),
      padding,
      Math.max(padding, viewportHeight - padding - popoverHeight),
    );
    const rawLeft = align === "right" ? rect.right - width : rect.left;
    const left = clamp(rawLeft, padding, Math.max(padding, viewportWidth - padding - width));
    setStyle({ top, left, width, maxHeight });
  }, [align, anchorRef, open]);

  const scheduleUpdate = useCallback(() => {
    if (!open || typeof window === "undefined") return;
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updatePosition();
    });
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    scheduleUpdate();
    const handleScroll = () => scheduleUpdate();
    const handleResize = () => scheduleUpdate();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [open, scheduleUpdate]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined" || !anchorRef.current) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="질문 예시"
      className="fixed z-[1000] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl transition-opacity"
      style={{
        top: style?.top ?? 0,
        left: style?.left ?? 0,
        width: style?.width ?? 260,
        maxHeight: style?.maxHeight ?? 320,
        opacity: style ? 1 : 0,
      }}
    >
      {isTeacherMode ? (
        <p className="text-[11px] font-semibold text-slate-400">이 교시 예시</p>
      ) : null}
      <div
        className={`${isTeacherMode ? "mt-2" : ""} flex max-h-[240px] flex-col gap-2 overflow-y-auto`}
        style={{
          maxHeight: style?.maxHeight ? Math.max(80, style.maxHeight - 32) : undefined,
        }}
      >
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
