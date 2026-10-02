"use client";

import { useEffect, useState } from "react";

import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

type GridHotkeysProps = {
  containerRef?: React.RefObject<HTMLElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenCompose?: () => void;
  onClosePanels?: () => void;
  composeEnabled?: boolean;
};

const KEYBOARD_HELP = [
  { key: "/", description: "검색으로 이동" },
  { key: "n", description: "새 카드 작성" },
  { key: "Esc", description: "오버레이/패널 닫기" },
  { key: "?", description: "단축키 도움말 열기" },
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  return target.isContentEditable;
}

export default function GridHotkeys({
  containerRef,
  searchInputRef,
  onOpenCompose,
  onClosePanels,
  composeEnabled = true,
}: GridHotkeysProps) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreHotkeyEvent(event)) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "n") {
        if (!composeEnabled) return;
        event.preventDefault();
        onOpenCompose?.();
        return;
      }

      if (event.key === "Escape") {
        onClosePanels?.();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }
    };

    const container = containerRef?.current;
    if (!container) return;
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [composeEnabled, containerRef, onClosePanels, onOpenCompose, searchInputRef]);

  return showHelp ? (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div data-no-compose-open className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">단축키</h2>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {KEYBOARD_HELP.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            >
              <span>{item.description}</span>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200">
                {item.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;
}
