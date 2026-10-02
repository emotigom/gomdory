"use client";

import type { PointerEvent } from "react";

import { useTouchLike } from "@/lib/ui/isTouchLike";

type DragHandleProps = {
  ariaLabel: string;
  isActive?: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
};

export default function DragHandle({ ariaLabel, isActive = false, onPointerDown }: DragHandleProps) {
  const { compact, touchLike } = useTouchLike();
  const isCompactUi = compact || touchLike;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      data-drag-handle
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-gray-500 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80 ${
        isActive
          ? "border-indigo-200 bg-indigo-50 text-indigo-600"
          : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white hover:text-gray-700"
      } cursor-grab active:cursor-grabbing ${isCompactUi ? "touch-pan-y" : "touch-none"}`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
        <circle cx="5" cy="5" r="1.5" fill="currentColor" />
        <circle cx="10" cy="5" r="1.5" fill="currentColor" />
        <circle cx="15" cy="5" r="1.5" fill="currentColor" />
        <circle cx="5" cy="15" r="1.5" fill="currentColor" />
        <circle cx="10" cy="15" r="1.5" fill="currentColor" />
        <circle cx="15" cy="15" r="1.5" fill="currentColor" />
      </svg>
    </button>
  );
}
