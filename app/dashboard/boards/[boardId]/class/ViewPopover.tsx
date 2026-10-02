"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import type { SavedView, ViewState } from "./useSavedViews";
import { stopTilePropagation } from "@/app/_components/interaction";

type ViewPopoverProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  viewState: ViewState;
  isSelectionMode: boolean;
  views: SavedView[];
  maxViews: number;
  onAddView: (input: { name: string; isPinned?: boolean; isDefault?: boolean }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onApplyView: (id: string) => void;
  onUpdateView: (
    id: string,
    patch: Partial<Pick<SavedView, "name" | "isPinned" | "isDefault">>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDeleteView: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

function summarizeViewState(state: ViewState, isSelectionMode: boolean) {
  const summary = [];
  summary.push(state.searchQuery ? `검색: ${state.searchQuery}` : "검색어 없음");
  if (isSelectionMode) {
    summary.push(state.showSelectedOnly ? "선택 카드만" : "전체 카드");
  } else {
    summary.push("선택 모드 아님");
  }
  summary.push(state.inboxOnly ? "Inbox만" : "전체/태그 포함");
  summary.push(state.tagsFilter?.length ? `태그 ${state.tagsFilter.length}개` : "태그 필터 없음");
  return summary.join(" · ");
}

export default function ViewPopover({
  isOpen,
  onOpenChange,
  viewState,
  isSelectionMode,
  views,
  maxViews,
  onAddView,
  onApplyView,
  onUpdateView,
  onDeleteView,
}: ViewPopoverProps) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const saveInputRef = useRef<HTMLInputElement | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const viewSummary = useMemo(
    () => summarizeViewState(viewState, isSelectionMode),
    [isSelectionMode, viewState],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setEditingViewId(null);
      setPendingDeleteId(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    saveInputRef.current?.focus();
  }, [isOpen]);

  const handleSaveView = async () => {
    setIsSaving(true);
    const result = await onAddView({ name: newViewName, isPinned: newIsPinned, isDefault: newIsDefault });
    setIsSaving(false);
    if (!result.ok) {
      setFeedback(result.error);
      return;
    }
    setNewViewName("");
    setNewIsPinned(false);
    setNewIsDefault(false);
    setFeedback(null);
  };

  const handleApplyView = (id: string) => {
    onApplyView(id);
    onOpenChange(false);
  };

  const startEditing = (view: SavedView) => {
    setEditingViewId(view.id);
    setEditingName(view.name);
    setPendingDeleteId(null);
  };

  const cancelEditing = () => {
    setEditingViewId(null);
    setEditingName("");
  };

  const confirmEditing = async (id: string) => {
    if (!editingName.trim()) {
      cancelEditing();
      return;
    }
    setIsSaving(true);
    const result = await onUpdateView(id, { name: editingName });
    setIsSaving(false);
    if (!result.ok) {
      setFeedback(result.error);
      return;
    }
    cancelEditing();
    setFeedback(null);
  };

  const confirmDelete = async (id: string) => {
    setIsSaving(true);
    const result = await onDeleteView(id);
    setIsSaving(false);
    if (!result.ok) {
      setFeedback(result.error);
      return;
    }
    setPendingDeleteId(null);
    setFeedback(null);
  };

  const handleUpdateFlags = async (id: string, patch: Partial<Pick<SavedView, "isPinned" | "isDefault">>) => {
    setIsSaving(true);
    const result = await onUpdateView(id, patch);
    setIsSaving(false);
    if (!result.ok) {
      setFeedback(result.error);
    }
  };

  const isAtLimit = views.length >= maxViews;
  const hasViews = views.length > 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="저장된 뷰 열기"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        data-dismiss-ignore="true"
        data-interactive="true"
        onPointerDown={stopTilePropagation}
        onClick={(event) => {
          stopTilePropagation(event);
          onOpenChange(!isOpen);
        }}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        뷰
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="dialog"
        showBackdrop
        onBackdropClick={() => onOpenChange(false)}
        className="w-80 rounded-xl border border-gray-200 bg-white p-4 text-xs shadow-xl"
      >
        <div id={popoverId}>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-700">현재 보기</p>
            <p className="rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">{viewSummary}</p>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">현재 보기 저장</p>
            <div className="flex items-center gap-2">
              <input
                ref={saveInputRef}
                value={newViewName}
                onChange={(event) => setNewViewName(event.target.value)}
                placeholder="뷰 이름"
                className="h-9 flex-1 rounded-md border border-gray-200 px-3 text-xs text-gray-900 focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              />
              <button
                type="button"
                onClick={handleSaveView}
                disabled={isSaving || isAtLimit || !newViewName.trim()}
                className="h-9 rounded-md border border-gray-200 bg-gray-900 px-3 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                저장
              </button>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-600">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={newIsPinned}
                  onChange={(event) => setNewIsPinned(event.target.checked)}
                  className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>핀으로 고정</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={newIsDefault}
                  onChange={(event) => setNewIsDefault(event.target.checked)}
                  className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>기본으로 설정</span>
              </label>
            </div>
            {isAtLimit ? (
              <p className="text-[11px] text-gray-500">최대 {maxViews}개까지 저장할 수 있어요.</p>
            ) : null}
            {feedback ? <p className="text-[11px] text-rose-500">{feedback}</p> : null}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">저장된 뷰</p>
            {!hasViews ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-[11px] text-gray-500">
                저장된 뷰가 없어요. 지금 상태를 저장해보세요.
              </div>
            ) : (
              <ul className="space-y-2">
                {views.map((view) => {
                  const isEditing = editingViewId === view.id;
                  const isPendingDelete = pendingDeleteId === view.id;
                  return (
                    <li key={view.id} className="rounded-lg border border-gray-100 bg-white px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        {isEditing ? (
                          <input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-xs"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyView(view.id)}
                            className="flex-1 text-left text-xs font-semibold text-gray-900 hover:text-gray-700"
                          >
                            <span className="flex items-center gap-2">
                              {view.name}
                              {view.isPinned ? (
                                <span className="rounded-full bg-gray-100 px-2 py-[2px] text-[10px] font-semibold text-gray-600">
                                  핀
                                </span>
                              ) : null}
                              {view.isDefault ? (
                                <span className="rounded-full bg-amber-50 px-2 py-[2px] text-[10px] font-semibold text-amber-700">
                                  기본
                                </span>
                              ) : null}
                            </span>
                          </button>
                        )}
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => confirmEditing(view.id)}
                              className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-500"
                            >
                              취소
                            </button>
                          </div>
                        ) : isPendingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => confirmDelete(view.id)}
                              className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600"
                            >
                              삭제
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-500"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditing(view)}
                              className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600"
                            >
                              이름
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(view.id)}
                              className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                        <label className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-[3px]">
                          <input
                            type="checkbox"
                            checked={view.isPinned}
                            onChange={(event) => void handleUpdateFlags(view.id, { isPinned: event.target.checked })}
                            className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>핀</span>
                        </label>
                        <label className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-[3px]">
                          <input
                            type="checkbox"
                            checked={view.isDefault}
                            onChange={(event) =>
                              void handleUpdateFlags(view.id, { isDefault: event.target.checked })
                            }
                            className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>기본</span>
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </AnchoredMenu>
    </div>
  );
}
