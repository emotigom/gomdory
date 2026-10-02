"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import type { SavedView } from "./useSavedViews";

type PinnedViewsBarProps = {
  views: SavedView[];
  activeViewId?: string | null;
  onApply: (id: string) => void;
  onTogglePin: (id: string, nextPinned?: boolean) => void;
  onSetDefault: (id: string) => void;
  onRename?: (id: string) => void;
};

export default function PinnedViewsBar({
  views,
  activeViewId,
  onApply,
  onTogglePin,
  onSetDefault,
  onRename,
}: PinnedViewsBarProps) {
  const pinnedViews = useMemo(
    () =>
      [...views]
        .filter((view) => view.isPinned)
        .sort((a, b) => {
          if (a.pinOrder !== b.pinOrder) {
            return a.pinOrder - b.pinOrder;
          }
          return a.name.localeCompare(b.name);
        }),
    [views],
  );

  const visibleTabs = pinnedViews.slice(0, 5);
  const overflowTabs = pinnedViews.slice(5);

  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const overflowAnchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuForId && !overflowOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuForId(null);
        setOverflowOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuForId, overflowOpen]);

  if (pinnedViews.length === 0) {
    return null;
  }

  const renderMenu = (view: SavedView) => {
    const nextPinned = !view.isPinned;
    return (
      <AnchoredMenu
        open={menuForId === view.id}
        anchorRef={menuAnchorRef}
        menuRef={menuRef}
        align="right"
        role="menu"
        showBackdrop
        onBackdropClick={() => setMenuForId(null)}
        className="w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
      >
        <button
          type="button"
          onClick={() => {
            onSetDefault(view.id);
            setMenuForId(null);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          기본으로 설정
        </button>
        <button
          type="button"
          onClick={() => {
            onTogglePin(view.id, nextPinned);
            setMenuForId(null);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          {view.isPinned ? "핀 해제" : "핀으로 고정"}
        </button>
        <button
          type="button"
          onClick={() => {
            onRename?.(view.id);
            setMenuForId(null);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          이름 변경
        </button>
      </AnchoredMenu>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-[11px] font-semibold text-gray-600">고정 뷰</span>
      {visibleTabs.map((view) => {
        const isActive = view.id === activeViewId;
        return (
          <div
            key={view.id}
            className="relative"
            onContextMenu={(event) => {
              event.preventDefault();
              menuAnchorRef.current = event.currentTarget;
              setMenuForId(view.id);
            }}
          >
            <button
              type="button"
              onClick={() => onApply(view.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                isActive
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
              }`}
            >
              <span className="truncate max-w-[160px]">{view.name}</span>
              {view.isDefault ? (
                <span className="rounded-full bg-amber-50 px-2 py-[2px] text-[10px] font-semibold text-amber-700">
                  기본
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={`${view.name} 더보기`}
              onClick={(event) => {
                menuAnchorRef.current = event.currentTarget;
                setMenuForId((current) => (current === view.id ? null : view.id));
              }}
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white text-xs font-bold text-gray-500 shadow-sm ring-1 ring-gray-200 transition hover:text-gray-800"
            >
              ⋯
            </button>
            {menuForId === view.id ? renderMenu(view) : null}
          </div>
        );
      })}
      {overflowTabs.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            ref={overflowAnchorRef}
            onClick={() => setOverflowOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-800 transition hover:border-gray-300"
          >
            더보기
            <span className="rounded-full bg-gray-100 px-1 text-[10px] text-gray-600">{overflowTabs.length}</span>
          </button>
          <AnchoredMenu
            open={overflowOpen}
            anchorRef={overflowAnchorRef}
            menuRef={overflowMenuRef}
            align="right"
            role="menu"
            showBackdrop
            onBackdropClick={() => setOverflowOpen(false)}
            className="w-60 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
          >
              <p className="px-2 pb-2 text-[11px] font-semibold text-gray-700">고정된 뷰</p>
              <ul className="space-y-1">
                {overflowTabs.map((view) => (
                  <li key={view.id} className="rounded-md px-2 py-1 hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onApply(view.id);
                          setOverflowOpen(false);
                        }}
                        className="flex items-center gap-2 truncate text-left text-[11px] font-semibold text-gray-800"
                      >
                        <span className="truncate">{view.name}</span>
                        {view.isDefault ? (
                          <span className="rounded-full bg-amber-50 px-2 py-[2px] text-[10px] font-semibold text-amber-700">
                            기본
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => onTogglePin(view.id, false)}
                        className="text-[10px] font-semibold text-gray-500 hover:text-gray-700"
                      >
                        해제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
          </AnchoredMenu>
        </div>
      ) : null}
    </div>
  );
}
