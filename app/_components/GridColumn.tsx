"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { useFormState } from "react-dom";

import type { CardColorToken } from "@/lib/types/cards";
import { getCardColorClass } from "@/lib/ui/cardColors";
import type { BoardDensity } from "@/lib/ui/useBoardPrefs";
import { useIntersectionObserver } from "@/lib/ui/useIntersectionObserver";
import { updateWallAction } from "@/app/dashboard/boards/[boardId]/actions";
import { useTouchLike } from "@/lib/ui/isTouchLike";

export type GridColumnCard = {
  id: string;
  wallId: string;
  text: string;
  authorName: string | null;
  createdAt: string;
  isHidden?: boolean;
  isPinned?: boolean;
  isFeatured?: boolean;
  cardColorToken: CardColorToken | null;
  hasAttachments?: boolean;
};

export type GridColumnWall = {
  id: string;
  title: string;
  description: string | null;
};

type LoadMoreAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type GridColumnProps = {
  wall: GridColumnWall;
  featuredCards?: GridColumnCard[];
  pinnedCards?: GridColumnCard[];
  cards: GridColumnCard[];
  density: BoardDensity;
  headerActions?: ReactNode;
  footerActions?: ReactNode;
  dragActive?: boolean;
  fileDropActive?: boolean;
  onQuickAdd?: (wallId: string) => void;
  onActivate?: (wallId: string) => void;
  isComposeActive?: boolean;
  isDraggingCard?: boolean;
  boardId?: string;
  allowTitleEdit?: boolean;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onCardClick: (card: GridColumnCard) => void;
  onCardToggleSelect?: (card: GridColumnCard) => void;
  selectedCardIds?: Set<string>;
  onCardDragStart?: (event: DragEvent<HTMLButtonElement>, card: GridColumnCard) => void;
  onCardDragEnd?: () => void;
  emptyMessage: string;
  loadMoreAction?: LoadMoreAction;
  highlightQuery?: string;
  minWidthClass?: string;
  autoLoadEnabled?: boolean;
};

const densityStyles: Record<
  BoardDensity,
  {
    columnPadding: string;
    title: string;
    gap: string;
    cardPadding: string;
    cardText: string;
    cardMeta: string;
  }
> = {
  s: {
    columnPadding: "p-3",
    title: "text-base",
    gap: "gap-2",
    cardPadding: "p-2.5",
    cardText: "text-xs",
    cardMeta: "text-[11px]",
  },
  m: {
    columnPadding: "p-4",
    title: "text-lg",
    gap: "gap-3",
    cardPadding: "p-3",
    cardText: "text-sm",
    cardMeta: "text-xs",
  },
  l: {
    columnPadding: "p-5",
    title: "text-xl",
    gap: "gap-4",
    cardPadding: "p-4",
    cardText: "text-base",
    cardMeta: "text-sm",
  },
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query?: string) {
  const trimmed = query?.trim();
  if (!trimmed) return text;
  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`} className="rounded bg-yellow-100 px-1">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function cardMatches(card: GridColumnCard, query?: string) {
  const trimmed = query?.trim().toLowerCase();
  if (!trimmed) return false;
  const text = card.text.toLowerCase();
  const author = card.authorName?.toLowerCase() ?? "";
  return text.includes(trimmed) || author.includes(trimmed);
}

function Section({
  label,
  cards,
  badgeClass,
  density,
  onCardClick,
  onCardToggleSelect,
  selectedCardIds,
  onCardDragStart,
  onCardDragEnd,
  highlightQuery,
}: {
  label: string;
  cards: GridColumnCard[];
  badgeClass: string;
  density: BoardDensity;
  onCardClick: (card: GridColumnCard) => void;
  onCardToggleSelect?: (card: GridColumnCard) => void;
  selectedCardIds?: Set<string>;
  onCardDragStart?: (event: React.DragEvent<HTMLButtonElement>, card: GridColumnCard) => void;
  onCardDragEnd?: () => void;
  highlightQuery?: string;
}) {
  if (cards.length === 0) return null;
  const styles = densityStyles[density];

  return (
    <div className="space-y-2">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${badgeClass}`}>
        {label}
      </span>
      <div className={`grid ${styles.gap}`}>
        {cards.map((card) => {
          const matched = cardMatches(card, highlightQuery);
          const selected = selectedCardIds?.has(card.id);
          return (
            <button
              key={card.id}
              type="button"
              draggable={Boolean(onCardDragStart)}
              onDragStart={onCardDragStart ? (event) => onCardDragStart(event, card) : undefined}
              onDragEnd={onCardDragEnd}
              data-card
              className={`group relative flex w-full flex-col gap-2 rounded-xl border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${styles.cardPadding} ${styles.cardText} ${
                getCardColorClass(card.cardColorToken)
              } ${matched ? "ring-2 ring-yellow-200" : ""} ${
                selected ? "border-indigo-200 ring-2 ring-indigo-200" : "border-gray-200"
              }`}
              onClick={() => onCardClick(card)}
            >
              <button
                type="button"
                aria-label="카드 선택"
                onClick={(event) => {
                  event.stopPropagation();
                  onCardToggleSelect?.(card);
                }}
                className={`absolute right-2 top-2 rounded-full border bg-white/90 p-1 text-xs font-semibold transition ${
                  selected
                    ? "border-indigo-200 text-indigo-600 shadow"
                    : "border-gray-200 text-gray-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                }`}
              >
                {selected ? "✓" : "○"}
              </button>
              <p className="line-clamp-4 whitespace-pre-wrap text-gray-900">
                {highlightText(card.text, highlightQuery)}
              </p>
              <div className={`flex flex-wrap items-center gap-2 text-gray-500 ${styles.cardMeta}`}>
                <span>{new Date(card.createdAt).toLocaleString("ko-KR")}</span>
                {card.authorName ? (
                  <span>작성자: {highlightText(card.authorName, highlightQuery)}</span>
                ) : null}
                {card.isFeatured ? (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">
                    대표
                  </span>
                ) : null}
                {card.isPinned ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    핀
                  </span>
                ) : null}
                {card.isHidden ? (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">
                    숨김
                  </span>
                ) : null}
                {card.hasAttachments ? (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                    첨부
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GridColumn({
  wall,
  featuredCards = [],
  pinnedCards = [],
  cards,
  density,
  headerActions,
  footerActions,
  dragActive,
  fileDropActive,
  onQuickAdd,
  onActivate,
  isComposeActive = false,
  isDraggingCard = false,
  boardId,
  allowTitleEdit = false,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardClick,
  onCardToggleSelect,
  selectedCardIds,
  onCardDragStart,
  onCardDragEnd,
  emptyMessage,
  loadMoreAction,
  highlightQuery,
  minWidthClass = "min-w-[320px] max-w-[360px]",
  autoLoadEnabled = false,
}: GridColumnProps) {
  const styles = densityStyles[density];
  const hasCards =
    featuredCards.length > 0 || pinnedCards.length > 0 || cards.length > 0;
  const totalCount = featuredCards.length + pinnedCards.length + cards.length;
  const canEditTitle = Boolean(allowTitleEdit && boardId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(wall.title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const titleFormRef = useRef<HTMLFormElement | null>(null);
  const [, updateWallFormAction] = useFormState(updateWallAction, { success: false });
  const { compact, touchLike } = useTouchLike();
  const isCompactUi = compact || touchLike;

  const shouldIgnoreQuickAdd = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest("[data-no-quickadd]")) return true;
    if (target.closest("[data-card]")) return true;
    if (target.closest("button, input, textarea, select, a")) return true;
    return false;
  };

  const handleAutoLoad = useMemo(() => {
    if (!autoLoadEnabled || !loadMoreAction || loadMoreAction.disabled) {
      return null;
    }
    return () => loadMoreAction.onClick();
  }, [autoLoadEnabled, loadMoreAction]);

  useEffect(() => {
    setTitleDraft(wall.title);
  }, [wall.title]);

  useEffect(() => {
    if (!isEditingTitle) return;
    const frame = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditingTitle]);

  const commitTitle = (mode: "submit" | "cancel") => {
    if (mode === "cancel") {
      setTitleDraft(wall.title);
      setIsEditingTitle(false);
      return;
    }
    const normalized = titleDraft.trim();
    if (!normalized) {
      setTitleDraft(wall.title);
      setIsEditingTitle(false);
      return;
    }
    if (normalized === wall.title) {
      setIsEditingTitle(false);
      return;
    }
    setTitleDraft(normalized);
    titleFormRef.current?.requestSubmit();
    setIsEditingTitle(false);
  };

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>(
    () => {
      handleAutoLoad?.();
    },
    { rootMargin: "240px 0px" },
  );

  return (
    <div
      data-wall-id={wall.id}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerEnter={() => onActivate?.(wall.id)}
      onPointerDownCapture={() => onActivate?.(wall.id)}
      className={`${minWidthClass} group flex-1 transition ${
        dragActive ? "ring-2 ring-indigo-300" : ""
      } ${fileDropActive ? "ring-2 ring-indigo-300" : ""} ${styles.columnPadding}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/85 px-4 py-2.5 shadow-sm backdrop-blur">
          <div className="min-w-0">
            {isEditingTitle && canEditTitle ? (
              <form ref={titleFormRef} action={updateWallFormAction} className="flex items-center">
                <input type="hidden" name="boardId" value={boardId ?? ""} />
                <input type="hidden" name="wallId" value={wall.id} />
                <input type="hidden" name="description" value={wall.description ?? ""} />
                <input
                  ref={titleInputRef}
                  name="title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => commitTitle("submit")}
                  inputMode="text"
                  enterKeyHint="done"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitTitle("submit");
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      commitTitle("cancel");
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className={`w-full bg-transparent font-semibold text-gray-900 focus:outline-none ${styles.title} ${
                    isCompactUi ? "py-1 text-base" : ""
                  }`}
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!canEditTitle) return;
                  setIsEditingTitle(true);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className={`group/title flex items-center gap-2 text-left ${
                  canEditTitle ? "cursor-text" : "cursor-default"
                }`}
              >
                <span className={`${styles.title} font-semibold text-gray-900`}>{wall.title}</span>
                {canEditTitle ? (
                  <span className="text-xs text-gray-400 opacity-0 transition group-hover/title:opacity-60 group-focus-visible/title:opacity-60">
                    ✎
                  </span>
                ) : null}
              </button>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 pl-3">
            <span className="text-xs font-semibold text-gray-500">{totalCount}개</span>
            {headerActions ? (
              <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                {headerActions}
              </div>
            ) : null}
          </div>
        </div>
        {wall.description ? (
          <p className="text-xs text-gray-500">{wall.description}</p>
        ) : null}
      </div>

      {footerActions ? <div className="mt-3">{footerActions}</div> : null}

      <div
        data-cards-list
        onPointerDownCapture={() => onActivate?.(wall.id)}
        onClick={(event) => {
          if (!onQuickAdd || event.button !== 0) return;
          if (isDraggingCard || isComposeActive) return;
          if (shouldIgnoreQuickAdd(event.target)) return;
          onQuickAdd(wall.id);
        }}
      >
        {!hasCards ? (
          <p className="mt-4 rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">
            {emptyMessage}
          </p>
        ) : (
          <div className={`mt-4 grid ${styles.gap}`}>
            <Section
              label="대표"
              cards={featuredCards}
              badgeClass="bg-purple-50 text-purple-700"
              density={density}
              onCardClick={onCardClick}
              onCardToggleSelect={onCardToggleSelect}
              selectedCardIds={selectedCardIds}
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              highlightQuery={highlightQuery}
            />
            <Section
              label="핀"
              cards={pinnedCards}
              badgeClass="bg-amber-50 text-amber-700"
              density={density}
              onCardClick={onCardClick}
              onCardToggleSelect={onCardToggleSelect}
              selectedCardIds={selectedCardIds}
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              highlightQuery={highlightQuery}
            />
            <Section
              label="카드"
              cards={cards}
              badgeClass="bg-gray-100 text-gray-600"
              density={density}
              onCardClick={onCardClick}
              onCardToggleSelect={onCardToggleSelect}
              selectedCardIds={selectedCardIds}
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              highlightQuery={highlightQuery}
            />
          </div>
        )}
      </div>

      {loadMoreAction ? (
        <div className="mt-4 space-y-2">
          <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
          <button
            type="button"
            onClick={loadMoreAction.onClick}
            disabled={loadMoreAction.disabled}
            className="w-full rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {loadMoreAction.label}
          </button>
          {autoLoadEnabled ? (
            <p className="text-center text-[11px] font-medium text-gray-400">자동으로 이어서 불러옵니다</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
