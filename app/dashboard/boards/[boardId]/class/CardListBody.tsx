"use client";

import type { PointerEvent, RefObject } from "react";
import { Fragment, useMemo } from "react";
import Link from "next/link";

import EmptyState from "@/app/_components/EmptyState";
import InlineAlert from "@/app/_components/InlineAlert";
import type { Card } from "@/lib/data/cards";
import type { CardFile } from "@/lib/data/files";
import type { BoardTag } from "@/lib/data/tags";

import BulkActionsBar, { type ExportableCard } from "./BulkActionsBar";
import CardListControls from "./CardListControls";
import CardRow from "./CardRow";
import type { ClassUiPrefs } from "./useUiPrefs";
import type { ClassMode } from "./classModes";

type FilesByCard = Record<string, CardFile[]>;

type DragState = {
  activeId: string | null;
  armedId: string | null;
  indicatorIndex: number | null;
  isDragging: boolean;
};

type ReorderContext = {
  dragState: DragState;
  getHandleProps: (id: string) => {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  };
  registerItem: (id: string) => (node: HTMLLIElement | null) => void;
  containerRef: RefObject<HTMLUListElement | null>;
};

type CardListBodyProps = {
  boardId: string;
  wallId: string;
  filesByCard: FilesByCard;
  writeLocked: boolean;
  orderedCardsCount: number;
  isFiltered: boolean;
  hasFilteredResults: boolean;
  visibleFeaturedCards: Card[];
  visiblePinnedCards: Card[];
  visibleNormalCards: Card[];
  visibleCardIds: string[];
  visibleIndexById: Map<string, number>;
  isSortMode: boolean;
  isSelectionMode: boolean;
  isAllSelected: boolean;
  selectedCount: number;
  selectedIds: string[];
  selectedCards: ExportableCard[];
  selectedCardId: string | null;
  activeCardId: string | null;
  highlightedCardId: string | null;
  canSoftDelete: boolean;
  softDeleteMessage?: string | null;
  buildCardHref: (cardId: string) => string;
  buildPageHref: (nextOffset?: number | null) => string;
  prevOffset: number | null;
  nextOffset: number | null;
  modeNotice: { message: string; id: number } | null;
  paletteMessage: { tone: "success" | "error"; text: string } | null;
  classMode: ClassMode;
  fullscreenNotice: string | null;
  uiPrefs: ClassUiPrefs;
  onDismissModeNotice: () => void;
  onDismissFullscreenNotice: () => void;
  onClearSearch: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExitSelection: () => void;
  onActivateCard: (cardId: string) => void;
  onToggleSelection: (cardId: string, options?: { range?: boolean; additive?: boolean }) => void;
  onMoveSelectedToWall: (wallId: string) => void;
  onRegisterCardRef: (
    cardId: string,
    node: HTMLLIElement | null,
    registerItem?: (id: string) => (node: HTMLLIElement | null) => void,
  ) => void;
  featuredReorder: ReorderContext;
  pinnedReorder: ReorderContext;
  normalReorder: ReorderContext;
  availableTags: BoardTag[];
  tagFilter: string[];
  onToggleTagFilter: (tagId: string) => void;
  onClearTagFilter: () => void;
  onApplyBulkTags: (
    input: { addTagIds: string[]; removeTagIds: string[] },
  ) => Promise<{ ok: boolean; error?: string }>;
  canEditTags: boolean;
  isUpdatingTags: boolean;
  tagEditDisabledReason?: string;
  onRefresh: () => void;
};

export default function CardListBody({
  boardId,
  wallId,
  filesByCard,
  writeLocked,
  orderedCardsCount,
  isFiltered,
  hasFilteredResults,
  visibleFeaturedCards,
  visiblePinnedCards,
  visibleNormalCards,
  visibleCardIds,
  visibleIndexById,
  isSortMode,
  isSelectionMode,
  isAllSelected,
  selectedCount,
  selectedIds,
  selectedCards,
  selectedCardId,
  activeCardId,
  highlightedCardId,
  canSoftDelete,
  softDeleteMessage,
  buildCardHref,
  buildPageHref,
  prevOffset,
  nextOffset,
  modeNotice,
  paletteMessage,
  classMode,
  fullscreenNotice,
  uiPrefs,
  onDismissModeNotice,
  onDismissFullscreenNotice,
  onClearSearch,
  onSelectAll,
  onClearSelection,
  onExitSelection,
  onActivateCard,
  onToggleSelection,
  onMoveSelectedToWall,
  onRegisterCardRef,
  featuredReorder,
  pinnedReorder,
  normalReorder,
  availableTags,
  tagFilter,
  onToggleTagFilter,
  onClearTagFilter,
  onApplyBulkTags,
  canEditTags,
  isUpdatingTags,
  tagEditDisabledReason,
  onRefresh,
}: CardListBodyProps) {
  const supportsCardOrdering = false;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isPresentMode = classMode === "present";

  const renderIndicator = () => (
    <li aria-hidden>
      <div className="h-1 rounded-full bg-indigo-200" />
    </li>
  );

  const renderSortableList = (
    cards: Card[],
    variant: "featured" | "pinned" | "normal",
    reorder: ReorderContext,
  ) => {
    const indicatorIndex = reorder.dragState.indicatorIndex;
    const showIndicator = isSortMode && reorder.dragState.isDragging;

    return (
      <ul
        ref={reorder.containerRef}
        className={uiPrefs.density === "compact" ? "space-y-3" : isPresentMode ? "space-y-6" : "space-y-4"}
      >
        {cards.map((card, index) => {
          const attachments = filesByCard[card.id] ?? [];
          const isSelected = isSelectionMode
            ? selectedIdSet.has(card.id)
            : selectedCardId === card.id;
          const isDragging = reorder.dragState.activeId === card.id;
          const isDragArmed = reorder.dragState.armedId === card.id;
          const isActive = activeCardId === card.id;

          return (
            <Fragment key={card.id}>
              {showIndicator && indicatorIndex === index ? renderIndicator() : null}
              <CardRow
                card={card}
                variant={variant}
                attachments={attachments}
                boardId={boardId}
                wallId={wallId}
                cardHref={buildCardHref(card.id)}
                isSelectionMode={isSelectionMode}
                isSelected={isSelected}
                isActive={isActive}
                isHighlighted={card.id === highlightedCardId}
                isDragging={isDragging}
                isDragArmed={isDragArmed}
                isSortMode={isSortMode}
                classMode={classMode}
                visibleIndex={visibleIndexById.get(card.id)}
                writeLocked={writeLocked}
                canSoftDelete={canSoftDelete}
                deleteDisabledReason={softDeleteMessage}
                uiPrefs={uiPrefs}
                onActivate={onActivateCard}
                onToggleSelection={onToggleSelection}
                onMoveSelectedToWall={() => onMoveSelectedToWall(card.wall_id)}
                registerItem={reorder.registerItem}
                onCardRef={onRegisterCardRef}
                getHandleProps={reorder.getHandleProps}
                onTagClick={onToggleTagFilter}
              />
            </Fragment>
          );
        })}
        {showIndicator && indicatorIndex === cards.length ? renderIndicator() : null}
      </ul>
    );
  };

  const renderedSelectionBar = useMemo(
    () =>
      isSelectionMode ? (
        <BulkActionsBar
          boardId={boardId}
          wallId={wallId}
          selectedCount={selectedCount}
          totalCount={visibleCardIds.length}
          selectedIds={selectedIds}
          selectedCards={selectedCards}
          isAllSelected={isAllSelected}
          writeLocked={writeLocked}
          canSoftDelete={canSoftDelete}
          deleteDisabledReason={softDeleteMessage ?? undefined}
          availableTags={availableTags}
          tagFilter={tagFilter}
          onToggleTagFilter={onToggleTagFilter}
          onClearTagFilter={onClearTagFilter}
          onApplyTags={onApplyBulkTags}
          canEditTags={canEditTags}
          isUpdatingTags={isUpdatingTags}
          tagEditDisabledReason={tagEditDisabledReason}
          onSelectAll={onSelectAll}
          onClearSelection={onClearSelection}
          onExitSelection={onExitSelection}
          onRefresh={onRefresh}
        />
      ) : null,
    [
      boardId,
      isAllSelected,
      isSelectionMode,
      onClearSelection,
      onExitSelection,
      onSelectAll,
      selectedCards,
      selectedCount,
      selectedIds,
      canSoftDelete,
      softDeleteMessage,
      visibleCardIds.length,
      wallId,
      writeLocked,
      availableTags,
      tagFilter,
      onToggleTagFilter,
      onClearTagFilter,
      onApplyBulkTags,
      canEditTags,
      isUpdatingTags,
      tagEditDisabledReason,
      onRefresh,
    ],
  );

  return (
    <>
      {modeNotice ? (
        <InlineAlert
          tone="info"
          title={modeNotice.message}
          className="py-2 text-xs"
          action={(
            <button
              type="button"
              onClick={onDismissModeNotice}
              className="rounded-full border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300"
            >
              닫기
            </button>
          )}
        />
      ) : null}
      {classMode === "collect" ? (
        <InlineAlert
          tone="success"
          title="수집 모드: Inbox 중심으로 새 카드를 빠르게 추가하세요."
          description="새 카드 입력을 계속 열어두고 태그 없는 카드(Inbox)만 우선 보여줘요."
          className="py-2 text-xs"
          action={(
            <a
              href="#card-form"
              className="rounded-full border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300"
            >
              새 카드로 이동
            </a>
          )}
        />
      ) : null}
      {classMode === "organize" && !isSelectionMode ? (
        <InlineAlert
          tone="info"
          title="정리 모드: 선택 모드를 켜고 Bulk 작업을 활용해 보세요."
          description="상단 선택 토글(X) 또는 단축키로 여러 카드를 선택해 태그/규칙/대량 작업을 빠르게 수행하세요."
          className="py-2 text-xs"
        />
      ) : null}
      {fullscreenNotice ? (
        <InlineAlert
          tone="warning"
          title={fullscreenNotice}
          className="py-2 text-xs"
          action={(
            <button
              type="button"
              onClick={onDismissFullscreenNotice}
              className="rounded-full border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300"
            >
              확인
            </button>
          )}
        />
      ) : null}
      {paletteMessage ? <InlineAlert tone={paletteMessage.tone} title={paletteMessage.text} /> : null}
      {classMode !== "present" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
          <CardListControls variant="filters" />
        </div>
      ) : null}
      {isSortMode && !supportsCardOrdering ? (
        <InlineAlert
          tone="info"
          title="정렬은 화면에서만 적용됩니다."
          description="저장 기능은 추후 제공될 예정이에요."
        />
      ) : null}
      {renderedSelectionBar}

      {orderedCardsCount === 0 ? (
        <EmptyState
          title="아직 자료가 없어요."
          description="첫 카드를 추가하고 학생들의 참여를 시작해보세요."
          action={
            <Link
              href="#card-form"
              className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              카드 작성하기
            </Link>
          }
        />
      ) : isFiltered && !hasFilteredResults ? (
        <EmptyState
          title="아직 자료가 없어요."
          description="다른 키워드로 검색하거나 초기화해 주세요."
          action={
            <button
              type="button"
              onClick={onClearSearch}
              className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              검색어 초기화
            </button>
          }
        />
      ) : (
        <div className="space-y-6" data-card-list-scroll-container>
          {visibleFeaturedCards.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4" data-card-section-id="featured">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-purple-800">대표 카드</h4>
                <span className="text-xs text-purple-700">{visibleFeaturedCards.length}개</span>
              </div>
              {renderSortableList(visibleFeaturedCards, "featured", featuredReorder)}
            </div>
          ) : null}

          {visiblePinnedCards.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4" data-card-section-id="pinned">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-amber-800">핀 고정</h4>
                <span className="text-xs text-amber-700">{visiblePinnedCards.length}개</span>
              </div>
              {renderSortableList(visiblePinnedCards, "pinned", pinnedReorder)}
            </div>
          ) : null}

          {visibleNormalCards.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4" data-card-section-id="normal">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">일반 카드</h4>
                <span className="text-xs text-gray-600">{visibleNormalCards.length}개</span>
              </div>
              {renderSortableList(visibleNormalCards, "normal", normalReorder)}
            </div>
          ) : null}
          {renderedSelectionBar}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {prevOffset !== null ? (
              <Link
                href={buildPageHref(prevOffset)}
                className="h-9 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                이전
              </Link>
            ) : null}
            {nextOffset !== null ? (
              <Link
                href={buildPageHref(nextOffset)}
                className="h-9 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                다음
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
