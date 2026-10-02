"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import type { BoardTag } from "@/lib/data/tags";

type TagFilterPopoverProps = {
  tags: BoardTag[];
  selectedIds: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (tagId: string) => void;
  onClear: () => void;
  canEdit: boolean;
  onCreateTag: (input: { name: string; color?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteTag: (tagId: string) => Promise<{ ok: boolean; error?: string }>;
  isRefreshing?: boolean;
};

export default function TagFilterPopover({
  tags,
  selectedIds,
  isOpen,
  onOpenChange,
  onToggle,
  onClear,
  canEdit,
  onCreateTag,
  onDeleteTag,
  isRefreshing,
}: TagFilterPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setQuery("");
      setNewTagName("");
      setNewTagColor("");
      setPendingDeleteId(null);
    }
  }, [isOpen]);

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

  const filteredTags = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return tags;
    }
    return tags.filter((tag) => tag.name.toLowerCase().includes(normalized));
  }, [query, tags]);

  const handleCreate = async () => {
    if (!newTagName.trim()) {
      setFeedback("태그 이름을 입력해주세요.");
      return;
    }
    setIsSubmitting(true);
    const result = await onCreateTag({ name: newTagName.trim(), color: newTagColor.trim() || null });
    setIsSubmitting(false);
    if (!result.ok) {
      setFeedback(result.error ?? "태그를 추가하지 못했습니다.");
      return;
    }
    setFeedback("태그를 추가했어요.");
    setNewTagName("");
    setNewTagColor("");
  };

  const handleDelete = async (tagId: string) => {
    setIsSubmitting(true);
    const result = await onDeleteTag(tagId);
    setIsSubmitting(false);
    if (!result.ok) {
      setFeedback(result.error ?? "태그를 삭제하지 못했습니다.");
      return;
    }
    setFeedback("태그를 삭제했어요.");
    setPendingDeleteId(null);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
        className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        태그
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align="right"
        role="dialog"
        showBackdrop
        onBackdropClick={() => onOpenChange(false)}
        className="w-96 space-y-3 rounded-xl border border-gray-200 bg-white p-4 text-xs shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="태그 검색"
            className="h-9 flex-1 rounded-md border border-gray-200 px-3 text-xs text-gray-900 focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          />
          <button
            type="button"
            onClick={onClear}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            초기화
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50">
          {filteredTags.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-gray-500">
              태그가 없습니다. {canEdit ? "새 태그를 추가해 보세요." : "보드 편집자에게 요청하세요."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredTags.map((tag) => {
                const isSelected = selectedIds.includes(tag.id);
                return (
                  <li key={tag.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => onToggle(tag.id)}
                      className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left transition ${
                        isSelected ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "hover:bg-white"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-gray-200"
                        style={tag.color ? { backgroundColor: tag.color } : undefined}
                        aria-hidden
                      />
                      <span className="flex-1 truncate font-semibold">{tag.name}</span>
                      {typeof tag.cardCount === "number" ? (
                        <span className="text-[11px] text-gray-500">카드 {tag.cardCount}</span>
                      ) : null}
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId((prev) => (prev === tag.id ? null : tag.id))}
                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                      >
                        삭제
                      </button>
                    ) : null}
                    {pendingDeleteId === tag.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-rose-600">삭제하시겠어요?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(tag.id)}
                          disabled={isSubmitting}
                          className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          확인
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canEdit ? (
          <div className="space-y-2 rounded-lg border border-gray-100 bg-white p-3">
            <p className="text-[11px] font-semibold text-gray-700">새 태그</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder="태그 이름"
                className="h-9 flex-1 rounded-md border border-gray-200 px-3 text-xs text-gray-900 focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              />
              <input
                value={newTagColor}
                onChange={(event) => setNewTagColor(event.target.value)}
                placeholder="색상(hex 또는 토큰)"
                className="h-9 flex-1 rounded-md border border-gray-200 px-3 text-xs text-gray-900 focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting}
                className="h-9 rounded-md border border-gray-200 bg-gray-900 px-3 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                추가
              </button>
            </div>
            <p className="text-[11px] text-gray-500">이름 1~32자 · 색상은 비워둘 수 있어요.</p>
          </div>
        ) : null}

        {feedback ? <p className="text-[11px] text-rose-500">{feedback}</p> : null}
        {isRefreshing ? <p className="text-[11px] text-gray-500">태그를 불러오는 중...</p> : null}
      </AnchoredMenu>
    </div>
  );
}
