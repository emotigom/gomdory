"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import CardMoreMenu from "../CardMoreMenu";
import { FileUploader } from "../walls/[wallId]/FileUploader";
import CardTile from "@/app/_components/CardTile";
import CardAttachments from "@/app/_components/CardAttachments";
import CollapsibleCardText from "@/app/_components/CollapsibleCardText";
import { preventNativeDragProps } from "@/app/_components/preventNativeDrag";
import { getCardColorClass, normalizeCardColorTone } from "@/lib/ui/cardColors";
import { useTouchLike } from "@/lib/ui/isTouchLike";
import type { Card } from "@/lib/data/cards";
import { isFinalArtwork } from "@/lib/board/finalArtwork";
import type { CardFile } from "@/lib/data/files";
import { normalizeExternalAttachments } from "@/lib/types/attachments";
import { removeCardUrlAttachment } from "@/lib/cards/urlAttachment";
import { removeOptimisticAttachmentById } from "@/lib/cards/optimisticAttachments";
import { routes } from "@/lib/standards/routes";
import { normalizePracticeSnapshotAttachment } from "@/lib/labs/practiceSnapshot";

import DragHandle from "./DragHandle";
import type { ClassMode } from "./classModes";
import type { ClassUiPrefs } from "./useUiPrefs";

type CardVariant = "featured" | "pinned" | "normal";

type CardRowProps = {
  card: Card;
  variant: CardVariant;
  attachments: CardFile[];
  boardId: string;
  wallId: string;
  cardHref: string;
  isSelectionMode: boolean;
  isSelected: boolean;
  isActive: boolean;
  isHighlighted: boolean;
  isDragging: boolean;
  isDragArmed?: boolean;
  isSortMode: boolean;
  classMode: ClassMode;
  visibleIndex: number | undefined;
  writeLocked: boolean;
  canSoftDelete: boolean;
  deleteDisabledReason?: string | null;
  uiPrefs: ClassUiPrefs;
  onActivate: (cardId: string) => void;
  onToggleSelection: (
    cardId: string,
    options?: { range?: boolean; additive?: boolean },
  ) => void;
  onMoveSelectedToWall?: () => void;
  registerItem?: (id: string) => (node: HTMLLIElement | null) => void;
  onCardRef: (
    cardId: string,
    node: HTMLLIElement | null,
    registerItem?: (id: string) => (node: HTMLLIElement | null) => void,
  ) => void;
  getHandleProps?: (id: string) => {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  };
  onTagClick?: (tagId: string) => void;
};

function CardRow({
  card,
  variant,
  attachments,
  boardId,
  wallId,
  cardHref,
  isSelectionMode,
  isSelected,
  isActive,
  isHighlighted,
  isDragging,
  isDragArmed = false,
  isSortMode,
  classMode,
  visibleIndex,
  writeLocked,
  canSoftDelete,
  deleteDisabledReason,
  uiPrefs,
  onActivate,
  onToggleSelection,
  onMoveSelectedToWall,
  registerItem,
  onCardRef,
  getHandleProps,
  onTagClick,
}: CardRowProps) {
  const externalAttachments = useMemo(
    () => normalizeExternalAttachments(card.external_attachments),
    [card.external_attachments],
  );
  const baseAttachmentItems = useMemo(
    () =>
      [
        ...attachments.map((file) => ({
          id: file.id,
          type: "file" as const,
          label: file.filename,
          url: apiV1Path(`files/${file.id}/download`),
          contentType: file.content_type,
          sizeBytes: file.size_bytes,
        })),
        ...externalAttachments.map((file, index) => {
          const practice = normalizePracticeSnapshotAttachment(file);
          if (practice) {
            return {
              id: `${card.id}-practice-${index}`,
              type: "practice" as const,
              label: practice.title,
              url: "",
              practice,
            };
          }

          return {
            id: `${card.id}-ext-${index}`,
            type: "url" as const,
            label: "filename" in file ? file.filename : "링크",
            url:
              "downloadPath" in file
                ? (file.downloadPath ?? file.url ?? "")
                : "",
          };
        }),
      ].filter((item) => item.type === "practice" || Boolean(item.url)),
    [attachments, card.id, externalAttachments],
  );
  const [optimisticAttachments, setOptimisticAttachments] =
    useState(baseAttachmentItems);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticAttachments(baseAttachmentItems);
    setAttachmentError(null);
  }, [baseAttachmentItems]);
  const isPresentMode = classMode === "present";
  const tileVariant = isPresentMode
    ? "present"
    : uiPrefs.density === "compact"
      ? "dense"
      : "default";
  const clampPreference = uiPrefs.textClampLines;
  const textClampClass =
    tileVariant === "dense"
      ? clampPreference >= 4
        ? "line-clamp-3"
        : "line-clamp-2"
      : tileVariant === "present"
        ? clampPreference >= 4
          ? "line-clamp-6"
          : "line-clamp-5"
        : clampPreference >= 4
          ? "line-clamp-4"
          : "line-clamp-3";
  const bodyTextClass = isPresentMode
    ? "text-base leading-relaxed"
    : "text-sm leading-relaxed";
  const metaTextClass = isPresentMode ? "text-sm" : "text-xs";
  const metaBadgeBase =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold";
  const cardColorTone = normalizeCardColorTone(card.card_color_token);
  const hasCustomCardColor = cardColorTone !== "default";
  const colorClass = getCardColorClass(cardColorTone);
  const isTileSelected = isSelected || isActive || isHighlighted;
  const { compact, touchLike } = useTouchLike();
  const isCompactUi = compact || touchLike;

  const handleCardRef = useCallback(
    (node: HTMLLIElement | null) => {
      onCardRef(card.id, node, registerItem);
    },
    [card.id, onCardRef, registerItem],
  );

  const handleToggleSelection = useCallback(
    (withRange?: boolean, additive?: boolean) => {
      if (!isSelectionMode) {
        return;
      }
      onToggleSelection(card.id, { range: withRange, additive });
    },
    [card.id, isSelectionMode, onToggleSelection],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLLIElement>) => {
      onActivate(card.id);
      if (!isSelectionMode) {
        return;
      }
      event.preventDefault();
      handleToggleSelection(event.shiftKey, event.metaKey || event.ctrlKey);
    },
    [card.id, handleToggleSelection, isSelectionMode, onActivate],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLLIElement>) => {
      if (!isSelectionMode) {
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        handleToggleSelection(event.shiftKey, event.metaKey || event.ctrlKey);
      }
    },
    [handleToggleSelection, isSelectionMode],
  );

  const handlePointerDown = useCallback(() => {
    onActivate(card.id);
  }, [card.id, onActivate]);

  const handleSelectButtonClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handleToggleSelection(event.shiftKey, event.metaKey || event.ctrlKey);
    },
    [handleToggleSelection],
  );

  const handleMenuStopPropagation = useCallback(
    (event: MouseEvent | PointerEvent) => {
      event.stopPropagation();
    },
    [],
  );

  const dragHandleProps = useMemo(() => {
    if (!getHandleProps) {
      return undefined;
    }
    return getHandleProps(card.id);
  }, [card.id, getHandleProps]);

  const handleDragPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!isCompactUi || event.pointerType !== "touch") {
        event.preventDefault();
      }
      event.stopPropagation();
      dragHandleProps?.onPointerDown(event);
    },
    [dragHandleProps, isCompactUi],
  );

  const handleTagClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, tagId: string) => {
      event.preventDefault();
      event.stopPropagation();
      onTagClick?.(tagId);
    },
    [onTagClick],
  );

  const handleRemoveFileAttachment = useCallback(
    async (boardFileId: string) => {
      setAttachmentError(null);
      const result = removeOptimisticAttachmentById(
        optimisticAttachments,
        boardFileId,
      );
      if (!result.removed) {
        return;
      }
      const removed = result.removed;
      setOptimisticAttachments(result.next);

      try {
        const res = await fetch(
          routes.api.v1("cards", card.id, "attachments", boardFileId),
          {
            method: "DELETE",
          },
        );
        if (!res.ok) {
          throw new Error("첨부 제거에 실패했습니다.");
        }
      } catch {
        setOptimisticAttachments((previous) => {
          const rollback = [...previous];
          const restoreIndex =
            result.removedIndex < 0
              ? rollback.length
              : Math.min(result.removedIndex, rollback.length);
          rollback.splice(restoreIndex, 0, removed);
          return rollback;
        });
        setAttachmentError(
          "첨부 제거에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    },
    [card.id, optimisticAttachments],
  );

  const handleRemoveUrlAttachment = useCallback(
    async (attachmentId: string) => {
      setAttachmentError(null);
      const result = removeOptimisticAttachmentById(
        optimisticAttachments,
        attachmentId,
      );
      if (!result.removed || result.removed.type !== "url") {
        return;
      }
      const removed = result.removed;
      setOptimisticAttachments(result.next);

      const nextAttachments = removeCardUrlAttachment(
        card.external_attachments,
        removed.url,
      );
      try {
        const response = await fetch(
          routes.api.v1("dashboard", "cards", card.id),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: card.text,
              externalAttachments: nextAttachments,
            }),
          },
        );
        if (!response.ok) {
          throw new Error("링크 제거에 실패했습니다.");
        }
      } catch {
        setOptimisticAttachments((previous) => {
          const rollback = [...previous];
          const restoreIndex =
            result.removedIndex < 0
              ? rollback.length
              : Math.min(result.removedIndex, rollback.length);
          rollback.splice(restoreIndex, 0, removed);
          return rollback;
        });
        setAttachmentError(
          "링크 제거에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    },
    [card.external_attachments, card.id, card.text, optimisticAttachments],
  );

  const dragGuards = useMemo(() => preventNativeDragProps(), []);

  return (
    <CardTile
      as="li"
      ref={(node) => handleCardRef(node as HTMLLIElement | null)}
      variant={tileVariant}
      interactive
      selected={isTileSelected || isDragging || isDragArmed}
      subdued={!hasCustomCardColor && !isTileSelected && variant === "normal"}
      className={`touch-pan-y select-text [-webkit-user-drag:none] ${colorClass} ${isSelected ? "ring-1 ring-indigo-300/80 border-indigo-200" : ""} ${isHighlighted ? "ring-2 ring-amber-200" : ""} ${isDragging ? "ring-2 ring-indigo-200" : ""} ${isDragArmed ? "ring-2 ring-indigo-200/70 scale-[1.01]" : ""}`}
      data-card-color-tone={cardColorTone}
      data-card-id={card.id}
      data-selected={isSelected ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      data-drag-armed={isDragArmed ? "true" : "false"}
      data-active={isActive ? "true" : "false"}
      data-index={visibleIndex}
      role={isSelectionMode ? "checkbox" : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
      aria-selected={isSelectionMode ? isSelected : undefined}
      aria-current={isActive ? "true" : undefined}
      tabIndex={isSelectionMode ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      {!isSelectionMode ? (
        <Link
          href={cardHref}
          aria-label="카드 상세 보기"
          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          {...dragGuards}
        />
      ) : null}
      <div className="relative z-10 space-y-4 pointer-events-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3 pointer-events-none">
            {isSelectionMode ? (
              <button
                type="button"
                onClick={handleSelectButtonClick}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 pointer-events-auto ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
                }`}
                aria-label={isSelected ? "카드 선택 해제" : "카드 선택"}
              >
                {isSelected ? "✓" : "선택"}
              </button>
            ) : null}
            <div className="flex min-w-0 flex-col gap-2">
              <CollapsibleCardText
                text={card.text}
                collapsedLines={
                  tileVariant === "present"
                    ? 8
                    : tileVariant === "dense"
                      ? 4
                      : 5
                }
                className={`${textClampClass} whitespace-pre-line ${bodyTextClass} text-gray-900`}
              />
              <div
                className={`flex flex-wrap items-center gap-2 ${metaTextClass} text-gray-600`}
              >
                <span className="text-gray-500">
                  {new Date(card.created_at).toLocaleString("ko-KR")}
                </span>
                {card.author_name ? (
                  <span className="text-gray-500">
                    작성자: {card.author_name}
                  </span>
                ) : null}
                {card.author_type ? (
                  <span
                    className={`${metaBadgeBase} border-gray-200 bg-gray-50 text-gray-700`}
                  >
                    {card.author_type === "teacher" ? "교사" : "학생"}
                  </span>
                ) : null}
                {isFinalArtwork(card.tags) ? (
                  <span className={`${metaBadgeBase} border-cyan-300 bg-cyan-50 text-cyan-900`}>
                    최종 작품
                  </span>
                ) : null}
                {card.is_hidden ? (
                  <span
                    className={`${metaBadgeBase} border-gray-200 bg-gray-50 text-gray-700`}
                  >
                    숨김
                  </span>
                ) : null}
                {variant === "featured" ? (
                  <span
                    className={`${metaBadgeBase} border-purple-200 bg-purple-50 text-purple-700`}
                  >
                    대표
                  </span>
                ) : null}
                {variant === "pinned" ? (
                  <span
                    className={`${metaBadgeBase} border-amber-200 bg-amber-50 text-amber-700`}
                  >
                    핀
                  </span>
                ) : null}
                {isDragging ? (
                  <span
                    className={`${metaBadgeBase} border-indigo-100 bg-indigo-50 text-indigo-700`}
                  >
                    정렬 중
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2 pointer-events-auto">
            {isSortMode ? (
              <div
                className="relative"
                onClick={handleMenuStopPropagation}
                onPointerDown={handleMenuStopPropagation}
              >
                <DragHandle
                  ariaLabel="카드 순서 변경"
                  isActive={isDragging}
                  onPointerDown={handleDragPointerDown}
                />
              </div>
            ) : null}
            <div
              className="flex shrink-0 items-start pointer-events-auto"
              onClick={handleMenuStopPropagation}
              onPointerDown={handleMenuStopPropagation}
            >
              <CardMoreMenu
                boardId={boardId}
                wallId={wallId}
                card={card}
                disableStatus={writeLocked}
                disableDelete={!canSoftDelete}
                deleteDisabledReason={
                  canSoftDelete
                    ? undefined
                    : (deleteDisabledReason ?? undefined)
                }
                detailHref={cardHref}
                onMoveSelected={onMoveSelectedToWall}
                showMoveSelected={
                  Boolean(onMoveSelectedToWall) && isSelectionMode
                }
              />
            </div>
          </div>
        </div>
        {card.tags && card.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] pointer-events-none">
            {card.tags.slice(0, 3).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={(event) => handleTagClick(event, tag.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 ${isPresentMode ? "px-3 py-1.5 text-sm" : ""} pointer-events-auto`}
              >
                <span
                  className="h-2 w-2 rounded-full border border-gray-200"
                  style={tag.color ? { backgroundColor: tag.color } : undefined}
                />
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
            {card.tags.length > 3 ? (
              <span className="rounded-full border border-dashed border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-500">
                +{card.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className="relative z-10 mt-3 space-y-3 rounded-xl border border-gray-200/80 bg-white/70 p-3"
        onClick={handleMenuStopPropagation}
        onPointerDown={handleMenuStopPropagation}
      >
        <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
          <span>첨부파일</span>
          <FileUploader
            cardId={card.id}
            disabled={writeLocked}
            inputId={`card-${card.id}-file-input`}
          />
        </div>
        <div className="space-y-3">
          <CardAttachments
            attachments={optimisticAttachments}
            mode="teacher"
            onRemoveFile={handleRemoveFileAttachment}
            onRemoveUrl={handleRemoveUrlAttachment}
            stopPropagation
          />
          {attachmentError ? (
            <p className="text-xs text-rose-600">{attachmentError}</p>
          ) : null}
          {optimisticAttachments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-4 text-center shadow-sm">
              <p className="text-sm font-semibold text-gray-800">
                아직 첨부가 없어요.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                필요한 자료를 업로드해 공유해 보세요.
              </p>
              {!writeLocked ? (
                <div className="mt-3 flex justify-center">
                  <label
                    htmlFor={`card-${card.id}-file-input`}
                    className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                  >
                    파일 추가
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {writeLocked ? (
        <p className="relative z-10 mt-2 text-xs text-gray-500">
          카드 상태 변경이 잠금 처리되었습니다.
        </p>
      ) : null}
    </CardTile>
  );
}

export default memo(CardRow);
