"use client";

import { useEffect, useId, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";

const shortcuts = [
  { label: "/", description: "검색" },
  { label: "⌘K", description: "명령 팔레트" },
  { label: "⌘/Ctrl+Z", description: "되돌리기" },
  { label: "Shift+⌘Z / Ctrl+Y", description: "다시 실행" },
  { label: "↑↓", description: "카드 이동" },
  { label: "Enter", description: "카드 열기" },
  { label: "Shift+↑↓", description: "범위 선택" },
  { label: "Space", description: "선택 토글" },
  { label: "S", description: "정렬 모드" },
  { label: "X", description: "선택 모드" },
];

type RecentEntry = {
  id: string;
  label: string;
  isActive: boolean;
};

type ModeBarProps = {
  isSortMode: boolean;
  isSelectionMode: boolean;
  isSafeMode?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleSort: () => void;
  onToggleSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  recentEntries: RecentEntry[];
  onJumpToRecent: (entryId: string) => void;
};

function HelpPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-label="단축키 도움말"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-600 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        ?
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="dialog"
        showBackdrop
        onBackdropClick={() => setIsOpen(false)}
        className="w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg"
      >
        <div id={popoverId}>
          <p className="text-xs font-semibold text-gray-700">단축키</p>
          <ul className="mt-2 space-y-1 text-gray-600">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.label} className="flex items-center justify-between gap-3">
                <span className="text-gray-500">{shortcut.description}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                  {shortcut.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </AnchoredMenu>
    </div>
  );
}

export default function ModeBar({
  isSortMode,
  isSelectionMode,
  canUndo,
  canRedo,
  onToggleSort,
  onToggleSelection,
  onUndo,
  onRedo,
  recentEntries,
  onJumpToRecent,
  isSafeMode = false,
}: ModeBarProps) {
  const modeLabel = isSortMode ? "정렬 모드" : isSelectionMode ? "선택 모드" : "기본 모드";
  const badgeStyles = isSortMode
    ? "bg-indigo-100 text-indigo-700"
    : isSelectionMode
      ? "bg-emerald-100 text-emerald-700"
      : "bg-gray-100 text-gray-600";
  const containerStyles = isSafeMode
    ? "rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-sm"
    : "rounded-xl border border-gray-100 bg-white/70 px-3 py-2 shadow-sm";
  const actionButtonBase =
    "inline-flex h-10 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${containerStyles}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles}`}>
          {modeLabel}
        </span>
        <span className="text-xs text-gray-500">모드</span>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleSelection}
            aria-label="선택 모드 토글"
            className={`${actionButtonBase} ${
              isSelectionMode
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
            }`}
          >
            선택 {isSelectionMode ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={onToggleSort}
            aria-label="정렬 모드 토글"
            className={`${actionButtonBase} ${
              isSortMode
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
            }`}
          >
            정렬 {isSortMode ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={onUndo}
            aria-label="되돌리기"
            title="되돌리기 (⌘/Ctrl+Z)"
            disabled={!canUndo}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={onRedo}
            aria-label="다시 실행"
            title="다시 실행 (Shift+⌘/Ctrl+Z · Ctrl+Y)"
            disabled={!canRedo}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            ↷
          </button>
          <RecentActionsPopover entries={recentEntries} onJump={onJumpToRecent} />
        </div>
        <HelpPopover />
      </div>
    </div>
  );
}

type RecentActionsPopoverProps = {
  entries: RecentEntry[];
  onJump: (entryId: string) => void;
};

function RecentActionsPopover({ entries, onJump }: RecentActionsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-label="최근 작업"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-600 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        🕘
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="dialog"
        showBackdrop
        onBackdropClick={() => setIsOpen(false)}
        className="w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg"
      >
        <div id={popoverId}>
          <p className="text-xs font-semibold text-gray-700">최근 작업</p>
          {entries.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">기록이 없습니다.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-gray-600">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onJump(entry.id)}
                    className={`flex-1 text-left text-xs ${
                      entry.isActive ? "font-semibold text-gray-900" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {entry.label}
                  </button>
                  {entry.isActive ? (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      현재
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AnchoredMenu>
    </div>
  );
}
