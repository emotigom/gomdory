"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useMemo, useState, useTransition } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import type { BoardTag } from "@/lib/data/tags";
import type { CardTag } from "@/lib/data/cards";

import { deleteCardAction } from "./actions";

export type ExportableCard = {
  id: string;
  text: string;
  authorName?: string | null;
  authorType?: string | null;
  createdAt: string;
  isHidden: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  cardColorToken: string | null;
  externalAttachments: Array<{ filename: string; downloadPath?: string | null; byteSize?: number | null }>;
  tags?: CardTag[];
};

type ExportResult = { ok: true; message: string } | { ok: false; message: string };

export async function exportSelectedCardsAsJson(cards: ExportableCard[]): Promise<ExportResult> {
  if (cards.length === 0) {
    return { ok: false, message: "선택된 카드가 없습니다." };
  }

  try {
    const payload = cards.map((card) => ({
      id: card.id,
      text: card.text,
      authorName: card.authorName,
      authorType: card.authorType,
      createdAt: card.createdAt,
      isHidden: card.isHidden,
      isPinned: card.isPinned,
      isFeatured: card.isFeatured,
      cardColorToken: card.cardColorToken,
      externalAttachments: card.externalAttachments,
    }));
    const serialized = JSON.stringify({ exportedAt: new Date().toISOString(), cards: payload }, null, 2);

    if (!navigator.clipboard) {
      return { ok: false, message: "클립보드 접근을 지원하지 않습니다." };
    }

    await navigator.clipboard.writeText(serialized);
    return { ok: true, message: "선택한 카드 JSON을 클립보드에 복사했어요." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "내보내기에 실패했어요.",
    };
  }
}

type BulkActionsBarProps = {
  boardId: string;
  wallId: string;
  selectedCount: number;
  totalCount: number;
  selectedIds: string[];
  selectedCards: ExportableCard[];
  isAllSelected: boolean;
  writeLocked: boolean;
  canSoftDelete: boolean;
  deleteDisabledReason?: string;
  availableTags: BoardTag[];
  tagFilter: string[];
  onToggleTagFilter: (tagId: string) => void;
  onClearTagFilter: () => void;
  onApplyTags: (
    input: { addTagIds: string[]; removeTagIds: string[] },
  ) => Promise<{ ok: boolean; error?: string }>;
  canEditTags: boolean;
  isUpdatingTags: boolean;
  tagEditDisabledReason?: string;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExitSelection: () => void;
  onRefresh: () => void;
};

const deleteInitialState = { success: false };

export default function BulkActionsBar({
  boardId,
  wallId,
  selectedCount,
  totalCount,
  selectedIds,
  selectedCards,
  isAllSelected,
  writeLocked,
  canSoftDelete,
  deleteDisabledReason,
  availableTags,
  tagFilter,
  onToggleTagFilter,
  onClearTagFilter,
  onApplyTags,
  canEditTags,
  isUpdatingTags,
  tagEditDisabledReason,
  onSelectAll,
  onClearSelection,
  onExitSelection,
  onRefresh,
}: BulkActionsBarProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [exportMessage, setExportMessage] = useState<null | { tone: "success" | "error"; text: string }>(
    null,
  );
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const togglePendingTag = (tagId: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(tagId) ? list.filter((id) => id !== tagId) : [...list, tagId]);
  };
  const [recommendMessage, setRecommendMessage] = useState<string | null>(null);
  const [isConfirmingRecommend, setIsConfirmingRecommend] = useState(false);
  const [recommendations, setRecommendations] = useState<
    Array<{ cardId: string; tagIds: string[]; matchedRules: Array<{ ruleId: string; tagId: string }> }>
  >([]);
  const [isRecommendPending, startRecommendTransition] = useTransition();
  const [isApplyRecommendPending, startApplyRecommendTransition] = useTransition();

  const handleToggleAddTag = (tagId: string) => {
    if (pendingRemoveTags.includes(tagId)) {
      setPendingRemoveTags((prev) => prev.filter((id) => id !== tagId));
    }
    togglePendingTag(tagId, pendingAddTags, setPendingAddTags);
  };

  const handleToggleRemoveTag = (tagId: string) => {
    if (pendingAddTags.includes(tagId)) {
      setPendingAddTags((prev) => prev.filter((id) => id !== tagId));
    }
    togglePendingTag(tagId, pendingRemoveTags, setPendingRemoveTags);
  };

  const handleApplyTags = async () => {
    if (!canEditTags) {
      setTagMessage(tagEditDisabledReason ?? "태그를 수정할 권한이 없습니다.");
      return;
    }
    if (pendingAddTags.length === 0 && pendingRemoveTags.length === 0) {
      setTagMessage("추가하거나 제거할 태그를 선택해주세요.");
      return;
    }
    setTagMessage(null);
    const result = await onApplyTags({ addTagIds: pendingAddTags, removeTagIds: pendingRemoveTags });
    if (!result.ok) {
      setTagMessage(result.error ?? "태그를 업데이트하지 못했습니다.");
      return;
    }
    setTagMessage("태그를 업데이트했어요.");
    setPendingAddTags([]);
    setPendingRemoveTags([]);
    setIsTagPanelOpen(false);
  };

  const handleLoadRecommendations = () => {
    if (!canEditTags) {
      setRecommendMessage(tagEditDisabledReason ?? "태그를 수정할 권한이 없습니다.");
      return;
    }
    if (selectedCount === 0) {
      setRecommendMessage("선택된 카드가 없습니다.");
      return;
    }
    setRecommendMessage(null);
    startRecommendTransition(async () => {
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/tag-rules/preview`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sampleCardIds: selectedIds }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          items?: Array<{ cardId: string; tagIds: string[]; matchedRules: Array<{ ruleId: string; tagId: string }> }>;
          message?: string;
        };
        if (!response.ok || !data.ok || !data.items) {
          setRecommendMessage(data.message ?? "추천 태그를 불러오지 못했습니다.");
          return;
        }
        setRecommendations(data.items);
        setIsConfirmingRecommend(true);
        if (data.items.every((item) => item.tagIds.length === 0)) {
          setRecommendMessage("추천할 태그가 없습니다.");
        }
      } catch (error) {
        setRecommendMessage(error instanceof Error ? error.message : "추천 태그를 불러오지 못했습니다.");
      }
    });
  };

  const handleApplyRecommendations = () => {
    if (!canEditTags) {
      setRecommendMessage(tagEditDisabledReason ?? "태그를 수정할 권한이 없습니다.");
      return;
    }
    if (totalRecommendedAdds === 0) {
      setRecommendMessage("추가할 추천 태그가 없습니다.");
      setIsConfirmingRecommend(false);
      return;
    }
    startApplyRecommendTransition(async () => {
      const errors: string[] = [];
      for (const item of recommendedAdds) {
        if (item.addTagIds.length === 0) continue;
        const existing = selectedCards.find((card) => card.id === item.cardId)?.tags ?? [];
        const existingIds = new Set(existing.map((tag) => tag.id));
        const merged = Array.from(new Set([...existingIds, ...item.addTagIds]));
        try {
          const response = await fetch(apiV1Path(`dashboard/cards/${item.cardId}/tags`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagIds: merged }),
          });
          const data = (await response.json()) as { ok: boolean; message?: string };
          if (!response.ok || !data.ok) {
            errors.push(data.message ?? item.cardId);
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : item.cardId);
        }
      }
      if (errors.length > 0) {
        setRecommendMessage(`일부 카드에 적용하지 못했습니다: ${errors[0]}`);
      } else {
        setRecommendMessage(`추천 태그 ${totalRecommendedAdds}개를 적용했어요.`);
        onRefresh();
      }
      setIsConfirmingRecommend(false);
    });
  };
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [pendingAddTags, setPendingAddTags] = useState<string[]>([]);
  const [pendingRemoveTags, setPendingRemoveTags] = useState<string[]>([]);
  const [tagMessage, setTagMessage] = useState<string | null>(null);

  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) {
      return "선택된 카드 없음";
    }
    return `${selectedCount}개 선택됨`;
  }, [selectedCount]);

  const recommendedAdds = useMemo(() => {
    const recMap = new Map(recommendations.map((item) => [item.cardId, item.tagIds]));
    return selectedCards.map((card) => {
      const existing = new Set((card.tags ?? []).map((tag) => tag.id));
      const recIds = recMap.get(card.id) ?? [];
      const addIds = recIds.filter((id) => !existing.has(id));
      return { cardId: card.id, addTagIds: addIds, existingCount: existing.size };
    });
  }, [recommendations, selectedCards]);

  const totalRecommendedAdds = useMemo(
    () => recommendedAdds.reduce((sum, item) => sum + item.addTagIds.length, 0),
    [recommendedAdds],
  );

  const handleExport = async () => {
    if (selectedCount === 0) {
      return;
    }
    const result = await exportSelectedCardsAsJson(selectedCards);
    setExportMessage({ tone: result.ok ? "success" : "error", text: result.message });
  };

  const handleDelete = () => {
    if (selectedCount === 0 || writeLocked || !canSoftDelete) {
      return;
    }
    setIsConfirmingDelete(true);
    setDeleteMessage(null);
  };

  const handleConfirmDelete = () => {
    if (selectedCount === 0 || writeLocked || !canSoftDelete) {
      return;
    }
    startTransition(async () => {
      const errors: string[] = [];
      for (const cardId of selectedIds) {
        const formData = new FormData();
        formData.set("boardId", boardId);
        formData.set("wallId", wallId);
        formData.set("cardId", cardId);
        const result = await deleteCardAction(deleteInitialState, formData);
        if (result.error) {
          errors.push(result.error);
        }
      }
      if (errors.length > 0) {
        setDeleteMessage(errors[0]);
      } else {
        setDeleteMessage("선택한 카드를 휴지통으로 이동했습니다.");
        onClearSelection();
      }
      setIsConfirmingDelete(false);
    });
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      onClearSelection();
    } else {
      onSelectAll();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {isConfirmingDelete ? (
        <InlineAlert
          tone="warning"
          title={`선택한 카드 ${selectedCount}개를 휴지통으로 이동합니다.`}
          description="휴지통에서 복구하거나 영구 삭제할 수 있습니다. 필요한 카드가 아닌지 한번 더 확인해주세요."
          action={
            <>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "이동 중..." : "휴지통으로 이동"}
              </button>
            </>
          }
        />
      ) : null}

      {isConfirmingRecommend ? (
        <InlineAlert
          tone="info"
          title="추천 태그 적용"
          description={
            totalRecommendedAdds > 0
              ? `${selectedCount}개 카드에 태그 ${totalRecommendedAdds}개를 추가합니다.`
              : "추천할 태그가 없습니다."
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingRecommend(false)}
                className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleApplyRecommendations}
                disabled={isApplyRecommendPending || totalRecommendedAdds === 0}
                className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyRecommendPending ? "적용 중..." : "추천 태그 적용"}
              </button>
            </div>
          }
        />
      ) : null}

      {deleteMessage ? (
        <InlineAlert
          tone={deleteMessage.includes("완료") ? "success" : "error"}
          title={deleteMessage}
        />
      ) : null}

      {recommendMessage ? <InlineAlert tone="info" title={recommendMessage} /> : null}

      {tagMessage ? (
        <InlineAlert tone={tagMessage.includes("업데이트") ? "success" : "info"} title={tagMessage} />
      ) : null}

      {exportMessage ? (
        <InlineAlert tone={exportMessage.tone} title={exportMessage.text} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {selectedLabel}
          </span>
          <button
            type="button"
            onClick={handleToggleAll}
            disabled={totalCount === 0}
            className="inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {isAllSelected ? "전체 해제" : "전체 선택"}
          </button>
          <button
            type="button"
            onClick={() => {
              onClearSelection();
              onExitSelection();
            }}
            className="inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            선택 모드 종료
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedCount === 0}
            className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            내보내기(JSON 복사)
          </button>
          <button
            type="button"
            onClick={handleLoadRecommendations}
            disabled={selectedCount === 0 || !canEditTags || isRecommendPending}
            className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRecommendPending ? "추천 계산 중..." : "추천 태그 적용"}
          </button>
          <button
            type="button"
            onClick={() => setIsTagPanelOpen((prev) => !prev)}
            disabled={selectedCount === 0 || !canEditTags || isUpdatingTags}
            className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            태그…
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-gray-100 px-3 text-xs font-semibold text-gray-400"
          >
            이동/정리
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={selectedCount === 0 || writeLocked || !canSoftDelete}
            className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            휴지통 이동
          </button>
        </div>
      </div>

      {isTagPanelOpen ? (
        <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-800">
            <span>선택한 카드에 태그를 추가/제거합니다.</span>
            <div className="flex flex-wrap items-center gap-2">
              {tagFilter.length > 0 ? (
                <>
                  {tagFilter.map((tagId) => {
                    const tag = availableTags.find((item) => item.id === tagId);
                    return (
                      <button
                        key={tagId}
                        type="button"
                        onClick={() => onToggleTagFilter(tagId)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
                      >
                        {tag?.name ?? "알 수 없는 태그"}
                        <span aria-hidden>✕</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={onClearTagFilter}
                    className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    필터 초기화
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-emerald-700">태그 필터 없음</span>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-800">추가할 태그</p>
              <div className="rounded-md border border-gray-200 bg-white">
                {availableTags.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-gray-500">태그가 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 text-sm">
                    {availableTags.map((tag) => {
                      const isSelected = pendingAddTags.includes(tag.id);
                      return (
                        <li key={tag.id}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleAddTag(tag.id)}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-300"
                            />
                            <span className="flex-1 truncate">{tag.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-800">제거할 태그</p>
              <div className="rounded-md border border-gray-200 bg-white">
                {availableTags.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-gray-500">태그가 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 text-sm">
                    {availableTags.map((tag) => {
                      const isSelected = pendingRemoveTags.includes(tag.id);
                      return (
                        <li key={tag.id}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleRemoveTag(tag.id)}
                              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-300"
                            />
                            <span className="flex-1 truncate">{tag.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplyTags}
              disabled={!canEditTags || isUpdatingTags}
              className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdatingTags ? "적용 중..." : "태그 적용"}
            </button>
            <button
              type="button"
              onClick={() => setIsTagPanelOpen(false)}
              className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              닫기
            </button>
            {!canEditTags ? (
              <span className="text-[11px] text-rose-600">
                {tagEditDisabledReason ?? "태그를 수정할 권한이 없습니다."}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {!canSoftDelete ? (
        <InlineAlert tone="info" title={deleteDisabledReason ?? "보드 정책으로 삭제가 제한되어 있어요."} />
      ) : null}

      <InlineAlert
        tone="info"
        title="이동/정리 기능은 곧 제공될 예정이에요."
        description="당장은 선택 삭제 또는 JSON 복사로 관리해 주세요."
      />
    </div>
  );
}
