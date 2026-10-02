"use client";

import { useEffect, useId, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
type SafeModeToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export default function SafeModeToggle({ enabled, onToggle }: SafeModeToggleProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative inline-flex items-center gap-2">
      <span className="rounded-full bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white">SAFE</span>
      <button
        type="button"
        aria-pressed={enabled}
        aria-controls={popoverId}
        aria-expanded={open}
        onClick={() => {
          onToggle();
        }}
        className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
          enabled
            ? "border-gray-900 bg-gray-900 text-white shadow-sm"
            : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
        }`}
      >
        Safe Mode {enabled ? "ON" : "OFF"}
      </button>
      <button
        type="button"
        aria-label="Safe Mode 도움말"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((prev) => !prev)}
        ref={triggerRef}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-600 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        ?
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="dialog"
        showBackdrop
        onBackdropClick={() => setOpen(false)}
        className="w-72 rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-xl"
      >
        <div id={popoverId}>
          <p className="text-xs font-semibold text-gray-800">교실 Safe Mode</p>
          <p className="mt-1 text-[11px] text-gray-600">
            TV에 노출될 때 깔끔하게 보이도록 고급 UI를 숨깁니다. 링크, 모드, 잠금/네트워크 상태만 또렷하게 남아요.
          </p>
          <p className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-800">
            단축키 · Shift+M
          </p>
          <p className="mt-1 text-[11px] text-gray-500">ESC로 열린 패널을 닫을 수 있습니다.</p>
        </div>
      </AnchoredMenu>
    </div>
  );
}
