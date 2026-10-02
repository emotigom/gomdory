"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import Link from "next/link";

import CardListControls from "./CardListControls";
import ClassModeBar from "./ClassModeBar";
import ModeBar from "./ModeBar";
import PinnedViewsBar from "./PinnedViewsBar";
import SafeModeToggle from "./SafeModeToggle";
import UiPrefsPopover from "./UiPrefsPopover";
import ViewPopover from "./ViewPopover";
import { formatKeySpecList } from "./keymapUtils";
import TagFilterPopover from "./TagFilterPopover";
import type { BoardTag } from "@/lib/data/tags";
import type { ClassUiPrefs } from "./useUiPrefs";
import type { SavedView, ViewState } from "./useSavedViews";
import type { ClassMode } from "./classModes";

type RecentHistoryItem = {
  id: string;
  label: string;
  isActive: boolean;
};

type CardListHeaderProps = {
  visibleCountLabel: string;
  isSortMode: boolean;
  isSelectionMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleSort: () => void;
  onToggleSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  recentHistoryItems: RecentHistoryItem[];
  onJumpToRecent: (entryId: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur: () => void;
  onClearSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showSearchDelayNotice: boolean;
  showSelectedOnly: boolean;
  onToggleShowSelectedOnly: () => void;
  showInboxOnly: boolean;
  onToggleInboxOnly: () => void;
  viewState: ViewState;
  activeViewId?: string | null;
  savedViews: SavedView[];
  isViewPopoverOpen: boolean;
  onViewPopoverChange: (open: boolean) => void;
  onSaveView: (input: { name: string; isPinned?: boolean; isDefault?: boolean }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onApplyView: (id: string) => void;
  onUpdateView: (
    id: string,
    patch: Partial<Pick<SavedView, "name" | "isPinned" | "isDefault" | "pinOrder">>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDeleteView: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onTogglePin: (id: string, nextPinned?: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSetDefault: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRenameView?: (id: string) => void;
  maxViews: number;
  uiPrefs: ClassUiPrefs;
  isUiPrefsOpen: boolean;
  onUiPrefsOpenChange: (open: boolean) => void;
  onUpdateUiPrefs: (patch: Partial<ClassUiPrefs>) => void;
  onToggleActivityPanel: () => void;
  isActivityPanelOpen: boolean;
  classMode: ClassMode;
  onClassModeChange: (mode: ClassMode) => void;
  onNextCard: () => void;
  onPrevCard: () => void;
  followEnabled: boolean;
  onToggleFollow: () => void;
  onExitPresent: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  tags: BoardTag[];
  selectedTags: string[];
  onToggleTagFilter: (tagId: string) => void;
  onClearTagFilter: () => void;
  isTagPopoverOpen: boolean;
  onTagPopoverChange: (open: boolean) => void;
  canEditTags: boolean;
  onCreateTag: (input: { name: string; color?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteTag: (tagId: string) => Promise<{ ok: boolean; error?: string }>;
  isRefreshingTags?: boolean;
  onOpenTagRules: () => void;
  isSafeMode: boolean;
  onToggleSafeMode: () => void;
};

export default function CardListHeader({
  visibleCountLabel,
  isSortMode,
  isSelectionMode,
  canUndo,
  canRedo,
  onToggleSort,
  onToggleSelection,
  onUndo,
  onRedo,
  recentHistoryItems,
  onJumpToRecent,
  searchTerm,
  onSearchChange,
  onSearchKeyDown,
  onSearchBlur,
  onClearSearch,
  searchInputRef,
  showSearchDelayNotice,
  showSelectedOnly,
  onToggleShowSelectedOnly,
  showInboxOnly,
  onToggleInboxOnly,
  viewState,
  activeViewId,
  savedViews,
  isViewPopoverOpen,
  onViewPopoverChange,
  onSaveView,
  onApplyView,
  onUpdateView,
  onDeleteView,
  onTogglePin,
  onSetDefault,
  onRenameView,
  maxViews,
  uiPrefs,
  isUiPrefsOpen,
  onUiPrefsOpenChange,
  onUpdateUiPrefs,
  onToggleActivityPanel,
  isActivityPanelOpen,
  classMode,
  onClassModeChange,
  onNextCard,
  onPrevCard,
  followEnabled,
  onToggleFollow,
  onExitPresent,
  onToggleFullscreen,
  isFullscreen,
  tags,
  selectedTags,
  onToggleTagFilter,
  onClearTagFilter,
  isTagPopoverOpen,
  onTagPopoverChange,
  canEditTags,
  onCreateTag,
  onDeleteTag,
  isRefreshingTags,
  onOpenTagRules,
  isSafeMode,
  onToggleSafeMode,
}: CardListHeaderProps) {
  const [showSafeExtras, setShowSafeExtras] = useState(false);
  const keyHint = (commandId: keyof ClassUiPrefs["keymap"]) => {
    const specs = uiPrefs.keymap[commandId] ?? [];
    return specs.length > 0 ? formatKeySpecList([specs[0]]) : "미설정";
  };

  const selectedTagMeta = useMemo(
    () =>
      selectedTags
        .map((id) => tags.find((tag) => tag.id === id))
        .filter((tag): tag is BoardTag => Boolean(tag)),
    [selectedTags, tags],
  );

  useEffect(() => {
    if (!isSafeMode) {
      setShowSafeExtras(false);
    }
  }, [isSafeMode]);

  useEffect(() => {
    if (!showSafeExtras) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSafeExtras(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSafeExtras]);

  const advancedControls = (
    <div className="flex flex-wrap items-start gap-2">
      <Link
        href="#card-form"
        className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        새 카드
      </Link>
      <TagFilterPopover
        tags={tags}
        selectedIds={selectedTagMeta.map((tag) => tag.id)}
        isOpen={isTagPopoverOpen}
        onOpenChange={onTagPopoverChange}
        onToggle={onToggleTagFilter}
        onClear={onClearTagFilter}
        canEdit={canEditTags}
        onCreateTag={onCreateTag}
        onDeleteTag={onDeleteTag}
        isRefreshing={isRefreshingTags}
      />
      <button
        type="button"
        onClick={onOpenTagRules}
        className="inline-flex h-9 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      >
        자동 태깅 규칙
      </button>
      <ViewPopover
        isOpen={isViewPopoverOpen}
        onOpenChange={onViewPopoverChange}
        viewState={viewState}
        isSelectionMode={isSelectionMode}
        views={savedViews}
        maxViews={maxViews}
        onAddView={onSaveView}
        onApplyView={onApplyView}
        onUpdateView={onUpdateView}
        onDeleteView={onDeleteView}
      />
      <UiPrefsPopover
        isOpen={isUiPrefsOpen}
        onOpenChange={onUiPrefsOpenChange}
        prefs={uiPrefs}
        onUpdatePrefs={onUpdateUiPrefs}
      />
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <label htmlFor="card-search-client" className="sr-only">
          카드 검색
        </label>
        <input
          id="card-search-client"
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          onBlur={onSearchBlur}
          placeholder="카드 검색"
          ref={searchInputRef}
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            초기화
          </button>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={onToggleShowSelectedOnly}
          disabled={!isSelectionMode}
          aria-pressed={showSelectedOnly}
          className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
            showSelectedOnly
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
          } ${isSelectionMode ? "" : "cursor-not-allowed opacity-50"}`}
        >
          선택 카드만 보기
        </button>
        {!isSelectionMode ? (
          <span className="text-[11px] text-gray-400">선택 모드에서 사용 가능</span>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={onToggleInboxOnly}
          aria-pressed={showInboxOnly}
          className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
            showInboxOnly
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
          }`}
        >
          Inbox(태그 없음)
        </button>
        <span className="text-[11px] text-gray-400">태그 없는 카드만 보기</span>
      </div>
      <CardListControls />
      <button
        type="button"
        onClick={onToggleActivityPanel}
        className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
          isActivityPanelOpen
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
        }`}
      >
        최근 활동
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">카드 목록</h3>
        <p className="text-xs text-gray-600">{visibleCountLabel}</p>
        {showSearchDelayNotice ? (
          <p className="text-xs text-gray-500">
            카드가 많아 검색 반영이 약간 지연될 수 있어요.
          </p>
        ) : null}
        {isSortMode ? (
          <p className="text-xs text-gray-500">드래그 핸들로 순서를 바꿀 수 있어요. (ESC로 드래그 취소)</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <ClassModeBar mode={classMode} onChange={onClassModeChange} />
          <SafeModeToggle enabled={isSafeMode} onToggle={onToggleSafeMode} />
          {classMode === "present" ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-800 shadow-sm">
              <span aria-hidden>🎤</span> 발표 모드 · 키보드: N/P/F/Esc
            </div>
          ) : null}
        </div>
        <PinnedViewsBar
          views={savedViews}
          activeViewId={activeViewId}
          onApply={onApplyView}
          onTogglePin={(id, nextPinned) => {
            void onTogglePin(id, nextPinned);
          }}
          onSetDefault={(id) => {
            void onSetDefault(id);
          }}
          onRename={onRenameView}
        />
        <ModeBar
          isSortMode={isSortMode}
          isSelectionMode={isSelectionMode}
          isSafeMode={isSafeMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onToggleSort={onToggleSort}
          onToggleSelection={onToggleSelection}
          onUndo={onUndo}
          onRedo={onRedo}
          recentEntries={recentHistoryItems}
          onJumpToRecent={onJumpToRecent}
        />
        {classMode === "present" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm">
              <span className="font-semibold text-gray-900">발표 컨트롤</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleFollow}
                  className={`inline-flex h-8 items-center rounded-full border px-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${
                    followEnabled
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                  }`}
                >
                  Follow {followEnabled ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={onPrevCard}
                  className="inline-flex h-8 items-center rounded-full border border-gray-200 px-3 font-semibold transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                >
                이전
              </button>
              <button
                type="button"
                onClick={onNextCard}
                className="inline-flex h-8 items-center rounded-full border border-gray-200 px-3 font-semibold transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                다음
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                className={`inline-flex h-8 items-center rounded-full border px-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
                  isFullscreen
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                }`}
              >
                전체화면 {isFullscreen ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={onExitPresent}
                className="inline-flex h-8 items-center rounded-full border border-rose-200 bg-rose-50 px-3 font-semibold text-rose-700 transition hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              >
                발표 종료
              </button>
            </div>
          </div>
        ) : null}
        {uiPrefs.showKeyboardHints ? (
          <p className="hidden text-xs text-gray-400 sm:block">
            {keyHint("focusSearch")} 검색 · {keyHint("navUp")}/{keyHint("navDown")} 이동 ·{" "}
            {keyHint("openActive")} 열기 · {keyHint("togglePalette")} 명령 · {keyHint("toggleSort")} 정렬 ·{" "}
            {keyHint("toggleSelection")} 선택
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {selectedTagMeta.length > 0 ? (
            <>
              {selectedTagMeta.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTagFilter(tag.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100 transition hover:bg-indigo-100"
                >
                  <span
                    className="h-2 w-2 rounded-full border border-gray-200"
                    style={tag.color ? { backgroundColor: tag.color } : undefined}
                  />
                  {tag.name}
                  <span aria-hidden>✕</span>
                </button>
              ))}
              <button
                type="button"
                onClick={onClearTagFilter}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                태그 초기화
              </button>
            </>
          ) : (
            <span className="text-[11px] text-gray-500">태그 필터 없음</span>
          )}
        </div>
      </div>
      <div className="relative flex flex-1 flex-wrap items-center justify-end gap-2">
        {isSafeMode ? (
          <div className="flex flex-1 flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSafeExtras((prev) => !prev)}
                className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                검색/필터 더보기
              </button>
              <span className="text-[11px] font-semibold text-gray-500">패널은 오버레이로 열립니다</span>
            </div>
            {showSafeExtras ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-full max-w-4xl rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">고급 컨트롤</p>
                  <button
                    type="button"
                    onClick={() => setShowSafeExtras(false)}
                    className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:border-gray-300"
                  >
                    닫기 (Esc)
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-500">필요할 때만 열리는 패널입니다.</p>
                  {advancedControls}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          advancedControls
        )}
      </div>
    </div>
  );
}
