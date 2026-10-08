"use client";

import { useEffect, useRef } from "react";

import type { CommandPaletteItem } from "./useCommandPalette";

type CommandPaletteProps = {
  isOpen: boolean;
  query: string;
  items: CommandPaletteItem[];
  activeIndex: number;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelect: (item: CommandPaletteItem) => void;
  onActiveChange: (index: number) => void;
  toggleHint?: string;
};

export default function CommandPalette({
  isOpen,
  query,
  items,
  activeIndex,
  onQueryChange,
  onClose,
  onSelect,
  onActiveChange,
  toggleHint,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-black/40"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="pointer-events-auto relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <label htmlFor="card-command-palette" className="sr-only">
            카드 명령 팔레트
          </label>
          <input
            ref={inputRef}
            id="card-command-palette"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="검색 또는 명령 실행 (예: 검색, 정렬, 선택, 내보내기)"
            aria-label="카드 명령 검색"
            className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 shadow-sm focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <div className="rounded-lg px-3 py-6 text-center text-sm text-gray-500">
              일치하는 명령이 없습니다.
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((item, index) => {
                const isActive = index === activeIndex;
                const isDisabled = !item.enabled;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseEnter={() => onActiveChange(index)}
                      onClick={() => onSelect(item)}
                      disabled={isDisabled}
                      className={`flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        isActive ? "bg-gray-900 text-white" : "bg-transparent text-gray-900"
                      } ${isDisabled ? "opacity-40" : "hover:bg-gray-100"}`}
                    >
                      <span className="flex flex-col gap-1">
                        <span className="font-semibold">{item.label}</span>
                        {item.description ? (
                          <span className={`${isActive ? "text-gray-200" : "text-gray-500"} text-xs`}>
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {isDisabled ? (
                        <span className={`${isActive ? "text-gray-300" : "text-gray-400"} text-xs`}>
                          사용 불가
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          <span>↑↓ 이동 · Enter 실행 · Esc 닫기</span>
          <span>{toggleHint ?? "⌘K / Ctrl+K"}</span>
        </div>
      </div>
    </div>
  );
}
