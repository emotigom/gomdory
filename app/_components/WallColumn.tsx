"use client";

import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { memo, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import MoreMenu from "@/app/_components/MoreMenu";
import useDismissableLayer from "@/app/_components/useDismissableLayer";
import CardTile from "@/app/_components/CardTile";
import CollapsibleCardText from "@/app/_components/CollapsibleCardText";
import type { Card } from "@/lib/data/cards";
import type { SharedCardAttachment } from "@/lib/boards/toSharedViewModel";
import CardMoreMenu from "@/app/dashboard/boards/[boardId]/CardMoreMenu";
import CardAttachments from "@/app/_components/CardAttachments";
import { deleteWallAction, updateWallAction } from "@/app/dashboard/boards/[boardId]/actions";
import { Resizable } from "re-resizable";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CARD_COLOR_LABELS, CARD_COLOR_OPTIONS, getCardColorClass, normalizeCardColorTone } from "@/lib/ui/cardColors";
import { isCardColorToken, type CardColorToken } from "@/lib/types/cards";
import { useTouchLike } from "@/lib/ui/isTouchLike";
import {
  DEFAULT_WALL_WIDTH,
  MAX_WALL_WIDTH,
  MIN_WALL_WIDTH,
  clampWallWidth,
  getAdjacentWallWidth,
} from "@/lib/ui/wallResize";
import { computeWindow } from "@/lib/ui/virtualWindow";
import type { CardAttachmentViewModel } from "@/app/_components/CardAttachments";

type WallColumnWall = {
  id: string;
  title: string;
  description?: string | null;
  ui_width_px: number;
  position: number;
  board_id?: string;
  ui_color_token?: string | null;
  student_write_enabled?: boolean;
};

type StudentCardMeta = {
  isOwnCard?: boolean;
  attachments?: SharedCardAttachment[];
  authorLabel?: string;
  title?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  sectionMoveOptions?: Array<{
    id: string;
    title: string;
    isCurrent: boolean;
  }>;
  onMoveToSection?: (wallId: string) => Promise<boolean>;
  movingSection?: boolean;
  sectionMoveError?: string | null;
  deleting?: boolean;
  deleteError?: string | null;
};

type WallColumnCard = Pick<
  Card,
  | "id"
  | "wall_id"
  | "author_type"
  | "author_name"
  | "text"
  | "created_at"
  | "position"
  | "is_hidden"
  | "is_pinned"
  | "is_featured"
  | "card_color_token"
> & {
  attachments?: Array<{
    id: string;
    kind: "image" | "file" | "url";
    label: string;
    url: string;
    contentType?: string | null;
    size?: number | null;
  }>;
  student?: StudentCardMeta;
};

type WallColumnProps = {
  canDragCard?: (cardId: string) => boolean;
  dragReadyCardId?: string | null;
  draggingCardId?: string | null;
  overWallId?: string | null;
  onCardHoldStart?: (cardId: string) => void;
  onCardHoldEnd?: (cardId: string) => void;
  role: "teacher" | "student";
  wall: WallColumnWall;
  cards: WallColumnCard[];
  onAddCard: (wallId: string) => void;
  onActivate?: (wallId: string) => void;
  onSelectCard?: (cardId: string, wallId: string) => void;
  selectedCardId?: string | null;
  onOpenWallMenu?: (wallId: string) => void;
  onResizeStop?: (wallId: string, newWidth: number) => void;
  alwaysShowCardMenu?: boolean;
  addDisabled?: boolean;
  addDisabledMessage?: string;
  emptyLabel?: string;
  onSpotlightSelect?: (wallId: string) => void;
  dragHandleRef?: (node: HTMLButtonElement | null) => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  isComposeActive?: boolean;
  isSpotlight?: boolean;
  isDimmed?: boolean;
  presentationLargeCards?: boolean;
  onColumnContextMenu?: (wallId: string, x: number, y: number) => void;
  onCardContextMenu?: (cardId: string, wallId: string, x: number, y: number) => void;
};

const toCardSortableId = (cardId: string) => `card:${cardId}`;

function SortableCardItem({
  card,
  wallId,
  disabled,
  draggingCardId,
  dragReadyCardId,
  onCardHoldStart,
  onCardHoldEnd,
  className,
  children,
  selected,
  variant,
  onClick,
  onContextMenu,
}: {
  card: WallColumnCard;
  wallId: string;
  disabled: boolean;
  draggingCardId?: string | null;
  dragReadyCardId?: string | null;
  onCardHoldStart?: (cardId: string) => void;
  onCardHoldEnd?: (cardId: string) => void;
  className: string;
  children: ReactNode;
  selected: boolean;
  variant: "default" | "present";
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toCardSortableId(card.id),
    disabled,
    data: { type: "card", wallId, cardId: card.id },
  });

  const dragHandleVisible = !disabled && (dragReadyCardId === card.id || draggingCardId === card.id);

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('[data-interactive="true"],button,a,input,textarea,select,[role="menu"],[role="menuitem"]'));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || isInteractiveTarget(event.target)) return;
    onCardHoldStart?.(card.id);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return;
    onCardHoldEnd?.(card.id);
  };

  return (
    <CardTile
      ref={setNodeRef}
      colorTone={card.card_color_token}
      data-card
      data-card-id={card.id}
      data-student-card={
        card.student
          ? card.student.isOwnCard
            ? "own"
            : card.author_type === "teacher"
              ? "teacher"
              : "peer"
          : undefined
      }
      data-card-position={typeof card.position === "number" ? card.position : undefined}
      data-column-id={wallId}
      data-drag-ready={dragReadyCardId === card.id ? "true" : "false"}
      data-dragging={draggingCardId === card.id ? "true" : "false"}
      variant={variant}
      selected={selected}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => onCardHoldEnd?.(card.id)}
      className={className}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        onClick?.();
      }}
      onContextMenu={onContextMenu}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.2 : undefined,
      }}
    >
      {!disabled ? (
        <div className="absolute left-2 top-2 z-10 pointer-events-none">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            aria-label="카드 이동"
            title="카드 이동"
            data-interactive="true"
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--theme-more-button-border)] bg-[var(--theme-more-button-bg)] text-[var(--theme-more-button-text)] shadow-sm backdrop-blur-sm transition hover:bg-[var(--theme-more-button-hover-bg)] focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] ${
              dragHandleVisible
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
            } cursor-grab active:cursor-grabbing`}
          >
            <span className="grid grid-cols-2 gap-1" aria-hidden>
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={`card-grip-${card.id}-${index}`} className="h-1 w-1 rounded-full bg-current" />
              ))}
            </span>
          </button>
        </div>
      ) : null}
      {children}
    </CardTile>
  );
}

const STUDENT_CARD_MENU_CSS_VARIABLES = [
  "--theme-menu-bg",
  "--theme-menu-text",
  "--theme-menu-muted-text",
  "--theme-menu-border",
  "--theme-menu-hover-bg",
  "--theme-menu-danger-text",
  "--theme-menu-danger-hover-bg",
  "--theme-focus",
  "--theme-card",
  "--theme-text",
] as const;

function StudentOwnedCardMenu({
  card,
  draggingCardId,
  isOpen,
  onOpenChange,
}: {
  card: WallColumnCard;
  draggingCardId?: string | null;
  isOpen: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const setIsOpen = useCallback((next: boolean) => onOpenChange(next), [onOpenChange]);

  useDismissableLayer({
    isOpen,
    setIsOpen,
    anchorRef: triggerRef,
    layerRef: menuRef,
    onDismiss: () => {
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
  });

  const actionsDisabled = Boolean(draggingCardId) || card.student?.deleting;

  return (
    <div className="absolute right-2 top-2 z-10" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="카드 옵션"
        title="카드 옵션"
        data-interactive="true"
        data-student-card-menu-trigger="true"
        data-testid="student-owned-card-menu-trigger"
        disabled={actionsDisabled}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--theme-more-button-border)] bg-[var(--theme-more-button-bg)] text-[var(--theme-more-button-text)] shadow-md shadow-slate-950/25 transition hover:bg-[var(--theme-more-button-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-card)] disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          background: "var(--theme-more-button-bg, var(--theme-card-strong, var(--theme-card)))",
          color: "var(--theme-more-button-text, var(--theme-card-text, var(--theme-text)))",
          borderColor: "var(--theme-more-button-border, var(--theme-border))",
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (draggingCardId) return;
          onOpenChange(!isOpen);
        }}
      >
        <span aria-hidden className="flex items-center gap-0.5">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        cssVariableSourceRef={triggerRef}
        cssVariableNames={STUDENT_CARD_MENU_CSS_VARIABLES}
        align="right"
        offset={6}
        role="menu"
        className="student-owned-card-menu-surface min-w-[220px] max-w-[calc(100vw-24px)] rounded-md border border-[var(--theme-menu-border)] bg-[var(--theme-menu-bg)] p-1 text-xs text-[var(--theme-menu-text)] shadow-xl shadow-slate-950/20"
        style={{
          background: "var(--theme-menu-bg, var(--theme-card-strong, var(--theme-card)))",
          color: "var(--theme-menu-text, var(--theme-card-text, var(--theme-text)))",
          borderColor: "var(--theme-menu-border, var(--theme-border))",
          isolation: "isolate",
          opacity: 1,
          filter: "none",
        }}
      >
        <div
          data-student-card-menu-popup="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {card.student?.sectionMoveOptions?.length ? (
            <div className="my-1 border-t border-[var(--theme-menu-border)] pt-1">
              <p className="px-2 py-1 text-[11px] font-bold text-[var(--theme-menu-muted-text)]">섹션 이동</p>
              <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                {card.student.sectionMoveOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitem"
                    data-interactive="true"
                    disabled={
                      Boolean(draggingCardId) ||
                      option.isCurrent ||
                      card.student?.movingSection ||
                      card.student?.deleting
                    }
                    onClick={async (event) => {
                      event.stopPropagation();
                      if (draggingCardId || option.isCurrent || card.student?.movingSection) return;
                      const moved = await card.student?.onMoveToSection?.(option.id);
                      if (moved) onOpenChange(false);
                    }}
                    className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 text-left text-[var(--theme-menu-text)] hover:border-[var(--theme-menu-border)] hover:bg-[var(--theme-menu-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] disabled:cursor-not-allowed disabled:text-[var(--theme-menu-muted-text)]"
                  >
                    <span className="min-w-0 truncate font-semibold">{option.title}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--theme-menu-muted-text)]">
                      {option.isCurrent
                        ? "현재 위치"
                        : card.student?.movingSection
                          ? "섹션 이동 중..."
                          : "이 섹션으로 이동"}
                    </span>
                  </button>
                ))}
              </div>
              {card.student.sectionMoveError ? (
                <p className="mt-1 rounded-md border border-[var(--theme-menu-danger-text)] bg-[var(--theme-menu-danger-hover-bg)] px-2 py-1.5 text-[11px] font-semibold text-[var(--theme-menu-danger-text)]">
                  {card.student.sectionMoveError}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            data-interactive="true"
            disabled={actionsDisabled}
            onClick={(event) => {
              event.stopPropagation();
              if (draggingCardId) return;
              card.student?.onEdit?.();
              onOpenChange(false);
            }}
            className="flex min-h-8 w-full items-center rounded-md border border-transparent px-2 py-1.5 text-left font-semibold text-[var(--theme-menu-text)] hover:border-[var(--theme-menu-border)] hover:bg-[var(--theme-menu-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] disabled:cursor-not-allowed disabled:text-[var(--theme-menu-muted-text)]"
          >
            수정
          </button>
          <button
            type="button"
            role="menuitem"
            data-interactive="true"
            disabled={actionsDisabled}
            onClick={(event) => {
              event.stopPropagation();
              if (draggingCardId || card.student?.deleting) return;
              card.student?.onDelete?.();
              onOpenChange(false);
            }}
            className="flex min-h-8 w-full items-center rounded-md border border-transparent px-2 py-1.5 text-left font-semibold text-[var(--theme-menu-danger-text)] hover:border-[var(--theme-menu-danger-text)] hover:bg-[var(--theme-menu-danger-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] disabled:cursor-not-allowed"
          >
            {card.student?.deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </AnchoredMenu>
    </div>
  );
}


const sectionMenuButtonClass = (compact: boolean) =>
  `flex w-full items-center justify-between rounded-md px-3 text-left text-sm text-[var(--theme-menu-text)] transition hover:bg-[var(--theme-menu-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] ${compact ? "min-h-10 py-2.5" : "min-h-9 py-2"}`;

function formatCardDate(isoDate?: string) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function WallColumn({
  role,
  wall,
  cards,
  onAddCard,
  onActivate,
  onSelectCard,
  selectedCardId,
  onOpenWallMenu,
  onResizeStop,
  alwaysShowCardMenu = false,
  addDisabled = false,
  addDisabledMessage,
  emptyLabel,
  onSpotlightSelect,
  dragHandleRef,
  dragHandleProps,
  isDragging = false,
  isComposeActive = false,
  isSpotlight = false,
  isDimmed = false,
  presentationLargeCards = false,
  onColumnContextMenu,
  onCardContextMenu,
  canDragCard,
  dragReadyCardId,
  draggingCardId,
  overWallId,
  onCardHoldStart,
  onCardHoldEnd,
}: WallColumnProps) {
  const visibleCount = cards.length;
  const showTeacherMenu = role === "teacher" && onOpenWallMenu;
  const boardId = wall.board_id ?? "";
  const isResizable = role === "teacher" && Boolean(onResizeStop);
  const canEditTitle = role === "teacher";
  const { compact, touchLike } = useTouchLike();
  const isCompactUi = compact || touchLike;
  const sectionStyle = {
    width: isResizable ? "100%" : `${wall.ui_width_px}px`,
    minWidth: role === "student" ? Math.max(MIN_WALL_WIDTH, 300) : MIN_WALL_WIDTH,
    maxWidth: role === "student" ? 360 : undefined,
  } as const;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [openStudentMenuCardId, setOpenStudentMenuCardId] = useState<string | null>(null);
  const gripDots = Array.from({ length: 6 });
  const [updateWallState, updateWallFormAction] = useActionState(updateWallAction, {
    success: false,
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(wall.title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const titleFormRef = useRef<HTMLFormElement | null>(null);
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [settingsColorToken, setSettingsColorToken] = useState<CardColorToken>(
    isCardColorToken(wall.ui_color_token ?? "") ? (wall.ui_color_token as CardColorToken) : "default",
  );
  const [settingsStudentWriteEnabled, setSettingsStudentWriteEnabled] = useState(
    wall.student_write_enabled ?? true,
  );
  const colorToken = settingsColorToken;
  const hasAccent = colorToken !== "default";
  const cardTextClass = presentationLargeCards ? "text-base" : "text-sm";
  const metaTextClass = presentationLargeCards ? "text-sm" : "text-xs";
  const stackGapClass = presentationLargeCards ? "space-y-4" : role === "student" ? "space-y-4" : "space-y-3";
  const emptyTitle = role === "teacher" ? "첫 카드를 추가해 보세요" : "아직 카드가 없어요";
  const emptyActionHint =
    role === "teacher"
      ? "빈 공간을 클릭하거나 카드 작성 버튼으로 시작할 수 있어요."
      : "첫 카드를 남겨 보세요.";
  const resolvedEmptyLabel =
    emptyLabel ??
    (role === "teacher"
      ? "이 섹션에는 아직 카드가 없습니다."
      : "사진이나 파일도 함께 올릴 수 있어요.");
  const estimatedCardHeight = presentationLargeCards ? 260 : 210;
  const shouldUseInternalScroll = role === "student" ? cards.length >= 7 : cards.length >= 5;
  const focusedCardIndex = focusedCardId ? cards.findIndex((card) => card.id === focusedCardId) : -1;
  const selectedCardIndex = selectedCardId ? cards.findIndex((card) => card.id === selectedCardId) : -1;
  const includeIndex = focusedCardIndex >= 0 ? focusedCardIndex : selectedCardIndex;
  const virtualWindow = computeWindow({
    itemCount: cards.length,
    itemHeightEstimate: estimatedCardHeight,
    scrollTop,
    viewportHeight,
    overscan: 5,
    includeIndex: includeIndex >= 0 ? includeIndex : null,
  });
  const visibleCards = cards.slice(virtualWindow.start, virtualWindow.end);
  useEffect(() => {
    if (!draggingCardId) return;
    setOpenStudentMenuCardId(null);
  }, [draggingCardId]);

  useEffect(() => {
    if (openStudentMenuCardId && !visibleCards.some((card) => card.id === openStudentMenuCardId)) {
      setOpenStudentMenuCardId(null);
    }
  }, [openStudentMenuCardId, visibleCards]);
  // Guardrail: use inset shadow hints instead of absolute overlays over card content.
  // If an overlay is reintroduced for fade, it must never cover body text or intercept pointers.
  const scrollEdgeShadow = [
    showTopFade ? "inset 0 10px 10px -10px rgba(148, 163, 184, 0.34)" : "",
    showBottomFade ? "inset 0 -10px 10px -10px rgba(148, 163, 184, 0.34)" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const toCardAttachmentViewModel = (card: WallColumnCard): CardAttachmentViewModel[] =>
    (card.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      type: attachment.kind === "url" ? "url" : "file",
      label: attachment.label,
      url: attachment.url,
      contentType: attachment.contentType,
      sizeBytes: attachment.size,
    }));

  const cardItems = useMemo(() => visibleCards.map((card) => toCardSortableId(card.id)), [visibleCards]);
  const { setNodeRef: setDropRef } = useDroppable({
    id: `wall:${wall.id}`,
    data: { type: "wall", wallId: wall.id },
  });


  const handleSpotlightClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!onSpotlightSelect) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
    onSpotlightSelect(wall.id);
  };

  const shouldIgnoreQuickAdd = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest("[data-no-quickadd]")) return true;
    if (target.closest("[data-card]")) return true;
    if (target.closest("button, input, textarea, select, a")) return true;
    return false;
  };

  // Guardrail: card click should not fire while users are dragging to select/copy text.
  const hasTextSelection = () => {
    if (typeof window === "undefined") return false;
    const selection = window.getSelection();
    return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
  };

  const updateScrollFades = () => {
    const element = contentRef.current;
    if (!element) return;
    const { scrollTop, clientHeight, scrollHeight } = element;
    setScrollTop(scrollTop);
    setViewportHeight(clientHeight);
    setShowTopFade(scrollTop > 0);
    setShowBottomFade(scrollTop + clientHeight < scrollHeight);
  };

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const handleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        updateScrollFades();
      });
    };
    updateScrollFades();
    element.addEventListener("scroll", handleScroll, { passive: true });
    const handleFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const cardNode = event.target.closest<HTMLElement>("[data-card-id]");
      setFocusedCardId(cardNode?.dataset.cardId ?? null);
    };
    element.addEventListener("focusin", handleFocusIn);
    window.addEventListener("resize", handleScroll);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(() => handleScroll());
      resizeObserverRef.current.observe(element);
    }
    return () => {
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("resize", handleScroll);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateScrollFades();
  }, [cards.length]);

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

  useEffect(() => {
    if (updateWallState.success || updateWallState.error) {
      setIsSubmittingSettings(false);
    }
  }, [updateWallState.error, updateWallState.success]);

  useEffect(() => {
    setSettingsColorToken(
      isCardColorToken(wall.ui_color_token ?? "") ? (wall.ui_color_token as CardColorToken) : "default",
    );
    setSettingsStudentWriteEnabled(wall.student_write_enabled ?? true);
  }, [wall.student_write_enabled, wall.ui_color_token]);

  const commitTitle = (mode: "submit" | "cancel") => {
    if (!canEditTitle) {
      setIsEditingTitle(false);
      return;
    }
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

  const content = (
    <section
      data-wall-column-runtime="WallColumn-v3"
      data-wall-id={wall.id}
      data-testid={role === "student" ? "student-board-section" : undefined}
      onPointerEnter={() => onActivate?.(wall.id)}
      onPointerDownCapture={() => onActivate?.(wall.id)}
      onContextMenu={(event) => {
        if (!onColumnContextMenu) return;
        if (event.target instanceof HTMLElement && event.target.closest("[data-card-id]")) return;
        event.preventDefault();
        onColumnContextMenu(wall.id, event.clientX, event.clientY);
      }}
      className={`group relative z-10 flex h-full min-h-0 flex-shrink-0 flex-col ${role === "student" ? "gap-4" : "gap-3"} rounded-2xl transition ${
        isDragging ? "opacity-70" : ""
      } ${isDimmed ? "opacity-60" : "opacity-100"} ${
        isSpotlight
          ? "z-20 scale-[1.02] shadow-2xl ring-2 ring-[var(--theme-border-strong)]"
          : "shadow-none"
      }`}
      style={sectionStyle}
    >
      <div className={`shrink-0 ${role === "student" ? "px-3 pt-3" : "px-4 pt-4"}`}>
        <div
          data-column-header="true"
          onClick={handleSpotlightClick}
          className={`flex items-center justify-between gap-3 ${role === "student" ? "rounded-xl" : "rounded-2xl"} border border-[var(--theme-section-border)] bg-[var(--theme-section-bg)] shadow-sm backdrop-blur transition ${
            isSpotlight ? "px-4 py-2.5 text-base" : "px-3 py-2 text-sm"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {dragHandleRef ? (
                <button
                  type="button"
                  ref={dragHandleRef}
                  {...dragHandleProps}
                  onPointerDown={(event) => {
                    dragHandleProps?.onPointerDown?.(event);
                    event.stopPropagation();
                  }}
                  onClick={(event) => event.preventDefault()}
                  className={`flex items-center justify-center rounded-md border border-transparent text-[var(--theme-section-handle)] transition hover:border-[var(--theme-section-border)] hover:bg-[var(--theme-menu-hover-bg)] hover:text-[var(--theme-section-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] active:cursor-grabbing cursor-grab ${isCompactUi ? "h-9 w-9 touch-pan-x touch-pan-y" : "h-7 w-7 touch-none"}`}
                  aria-label="섹션 순서 변경"
                >
                <span className="grid grid-cols-2 gap-0.5">
                  {gripDots.map((_, index) => (
                    <span key={`grip-${index}`} className="h-1 w-1 rounded-full bg-current" />
                  ))}
                </span>
              </button>
            ) : (
              <span className="grid grid-cols-2 gap-0.5 text-[var(--theme-section-handle)]">
                {gripDots.map((_, index) => (
                  <span key={`grip-static-${index}`} className="h-1 w-1 rounded-full bg-current" />
                ))}
              </span>
            )}
            {hasAccent ? (
              <span
                className={`h-2.5 w-2.5 rounded-full ring-2 ring-[var(--theme-section-border)] ${getCardColorClass(colorToken)}`}
                title={`${CARD_COLOR_LABELS[colorToken]} 강조`}
              />
            ) : null}
            {isEditingTitle && canEditTitle ? (
              <form ref={titleFormRef} action={updateWallFormAction} className="min-w-0 flex-1">
                <input type="hidden" name="boardId" value={boardId} />
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
                  className={`w-full bg-transparent font-semibold tracking-[0.02em] text-[var(--theme-section-text)] focus:outline-none ${isCompactUi ? "text-base py-1" : "text-[15px]"}`}
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
                <h2
                  className={`font-semibold tracking-[0.02em] text-[var(--theme-section-text)] ${
                    isSpotlight ? "text-base" : "text-[15px]"
                  }`}
                >
                  {wall.title}
                </h2>
                {canEditTitle ? (
                  <span className="text-xs text-[var(--theme-section-muted-text)] opacity-0 transition group-hover/title:opacity-60 group-focus-visible/title:opacity-60">
                    ✎
                  </span>
                ) : null}
              </button>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className={`font-semibold text-[var(--theme-section-muted-text)] ${isSpotlight ? "text-sm" : "text-xs"}`}>
              {visibleCount}개
            </span>
            {showTeacherMenu ? (
              <div className="opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <MoreMenu label="섹션 메뉴">
                  <button
                    type="button"
                    onClick={() => onOpenWallMenu(wall.id)}
                    className={sectionMenuButtonClass(isCompactUi)}
                  >
                    섹션 이름/설명 수정
                  </button>
                  <div className="my-1 border-t border-[var(--theme-menu-border)]" />
                  <form
                    action={updateWallFormAction}
                    className="space-y-3 rounded-md px-3 py-2"
                    onSubmit={() => setIsSubmittingSettings(true)}
                  >
                    <input type="hidden" name="boardId" value={boardId} />
                    <input type="hidden" name="wallId" value={wall.id} />
                    <input type="hidden" name="title" value={wall.title} />
                    <input type="hidden" name="description" value={wall.description ?? ""} />
                    <input
                      type="hidden"
                      name="studentWriteEnabled"
                      value={settingsStudentWriteEnabled ? "true" : "false"}
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--theme-menu-text)]">섹션 강조색</p>
                      <div className="grid grid-cols-3 gap-2">
                        {CARD_COLOR_OPTIONS.map((option) => (
                          <label
                            key={option.token}
                            className="flex items-center gap-2 text-xs text-[var(--theme-menu-muted-text)]"
                          >
                            <input
                              type="radio"
                              name="uiColorToken"
                              value={option.token === "default" ? "" : option.token}
                              checked={option.token === colorToken}
                              onChange={() => {
                                setSettingsColorToken(option.token);
                              }}
                              className="h-3 w-3 accent-[var(--theme-accent)]"
                            />
                            <span
                              className={`h-3 w-3 rounded-full ring-1 ring-[var(--theme-menu-border)] ${option.className}`}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--theme-menu-border)] bg-[var(--theme-menu-hover-bg)] px-2 py-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[var(--theme-menu-text)]">학생 제출 허용</p>
                        <p className="text-[11px] text-[var(--theme-menu-muted-text)]">잠그면 학생이 제출할 수 없어요.</p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={settingsStudentWriteEnabled}
                          onClick={() => {
                            setSettingsStudentWriteEnabled((prev) => !prev);
                          }}
                          className={`relative h-5 w-9 rounded-full transition ${
                            settingsStudentWriteEnabled ? "bg-[var(--theme-success)]" : "bg-[var(--theme-menu-border)]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--theme-menu-bg)] shadow transition ${
                              settingsStudentWriteEnabled ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                    {updateWallState.error ? (
                      <p className="rounded-md border border-[var(--theme-menu-danger-text)] bg-[var(--theme-menu-danger-hover-bg)] px-2 py-1 text-[11px] text-[var(--theme-menu-danger-text)]">
                        {updateWallState.error}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={isSubmittingSettings}
                      className={`flex w-full items-center justify-center rounded-md border border-[var(--theme-menu-border)] bg-[var(--theme-menu-bg)] text-xs font-semibold text-[var(--theme-menu-text)] transition hover:bg-[var(--theme-menu-hover-bg)] disabled:cursor-not-allowed disabled:text-[var(--theme-menu-muted-text)] ${isCompactUi ? "min-h-9" : "min-h-8"}`}
                    >
                      {isSubmittingSettings ? "저장 중..." : "설정 저장"}
                    </button>
                  </form>
                  <div className="my-1 border-t border-[var(--theme-menu-border)]" />
                  <form action={deleteWallAction}>
                    <input type="hidden" name="boardId" value={boardId} />
                    <input type="hidden" name="wallId" value={wall.id} />
                    <button
                      type="submit"
                      className={`flex w-full items-center justify-between rounded-md px-3 text-left text-sm text-[var(--theme-menu-danger-text)] transition hover:bg-[var(--theme-menu-danger-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] ${isCompactUi ? "min-h-10 py-2.5" : "min-h-9 py-2"}`}
                    >
                      섹션 삭제
                    </button>
                  </form>
                </MoreMenu>
              </div>
            ) : null}
          </div>
        </div>
        {wall.description ? (
          <p className="mt-2 line-clamp-2 text-xs text-[var(--theme-section-muted-text)]">{wall.description}</p>
        ) : null}
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${role === "student" ? "gap-3" : "gap-2"}`}>
        <div
          ref={(node) => {
            contentRef.current = node;
            setDropRef(node);
          }}
          data-cards-list
          data-section-empty-area="true"
          data-column-scroll-body="true"
          data-scroll="wall-column"
          data-wall-scroll="vertical"
          data-wall-id={wall.id}
          onPointerDownCapture={() => onActivate?.(wall.id)}
          onClick={(event) => {
            if (event.button !== 0) return;
            if (addDisabled || isDragging || isComposeActive) return;
            if (shouldIgnoreQuickAdd(event.target)) return;
            onAddCard(wall.id);
          }}
          className={`relative flex min-h-0 flex-1 flex-col justify-start ${role === "student" ? "px-3" : "px-4 pr-3"} ${shouldUseInternalScroll ? role === "student" ? "max-h-[min(calc(100vh-18rem),calc(100dvh-18rem))] overflow-y-auto overscroll-contain touch-pan-y [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.28)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--theme-border)] hover:[scrollbar-color:rgba(148,163,184,0.55)_transparent] hover:[&::-webkit-scrollbar-thumb]:bg-[var(--theme-border-strong)]" : "max-h-[min(calc(100vh-18rem),calc(100dvh-18rem))] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--theme-border)] hover:[scrollbar-color:rgba(148,163,184,0.7)_transparent] hover:[&::-webkit-scrollbar-thumb]:bg-[var(--theme-border-strong)]" : "overflow-visible"} ${overWallId === wall.id ? "ring-2 ring-inset ring-[var(--theme-focus)]" : ""}`}
          style={scrollEdgeShadow ? { boxShadow: scrollEdgeShadow } : undefined}
        >
          {cards.length === 0 ? (
            <div
              data-testid="guest-card-compose-hint"
              data-section-empty-area="true"
              className="rounded-xl border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-section-bg)] px-3 py-6 text-center"
            >
              <p className="text-sm font-semibold text-[var(--theme-section-text)]">{emptyTitle}</p>
              <p className="mt-1 text-xs text-[var(--theme-section-muted-text)]">{emptyActionHint}</p>
              <p className="mt-2 text-xs text-[var(--theme-text-subtle)]">{resolvedEmptyLabel}</p>
            </div>
          ) : role === "teacher" ? (
            <>
              {virtualWindow.topSpacer > 0 ? <div aria-hidden style={{ height: virtualWindow.topSpacer }} /> : null}
              <SortableContext items={cardItems} strategy={verticalListSortingStrategy}>
              <div className={stackGapClass}>
                {visibleCards.map((card) => {
              const authorLabel = card.author_name || "익명";
              const token = normalizeCardColorTone(card.card_color_token);
              const cardToneClass = token === "default" ? "border-[var(--theme-border)]" : "";

              const liftClass =
                dragReadyCardId === card.id
                  ? "animate-[wiggle_0.22s_ease-in-out_infinite_alternate] scale-[0.985] shadow-lg"
                  : draggingCardId === card.id
                    ? "scale-[0.96] opacity-90 shadow-xl"
                    : "";

              return (
                <SortableCardItem
                  key={card.id}
                  card={card}
                  wallId={wall.id}
                  disabled={!canDragCard?.(card.id)}
                  draggingCardId={draggingCardId}
                  dragReadyCardId={dragReadyCardId}
                  variant={presentationLargeCards ? "present" : "default"}
                  onCardHoldStart={onCardHoldStart}
                  onCardHoldEnd={onCardHoldEnd}
                  selected={card.id === selectedCardId}
                  onClick={() => {
                    if (hasTextSelection()) return;
                    onSelectCard?.(card.id, wall.id);
                  }}
                  onContextMenu={(event) => {
                    if (!onCardContextMenu) return;
                    event.preventDefault();
                    onCardContextMenu(card.id, wall.id, event.clientX, event.clientY);
                  }}
                  className={`w-full max-w-full self-stretch pt-10 transform-gpu will-change-transform ${cardToneClass} ${card.student?.isOwnCard ? "ring-1 ring-[var(--theme-border-strong)]/50" : ""} ${liftClass}`}
                >
                  {alwaysShowCardMenu ? (
                    <div className="absolute right-2 top-2 z-10 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <CardMoreMenu
                        boardId={boardId}
                        wallId={wall.id}
                        card={{
                          id: card.id,
                          text: card.text,
                          is_hidden: card.is_hidden,
                          is_pinned: card.is_pinned,
                          is_featured: card.is_featured,
                          card_color_token: card.card_color_token,
                        }}
                        disableStatus={!boardId}
                        pendingStatusMessage={!boardId ? "준비 중" : undefined}
                        disableDelete={!boardId}
                        deleteDisabledReason={!boardId ? "준비 중" : undefined}
                        title={card.student?.title}
                      />
                    </div>
                  ) : null}
                  <CollapsibleCardText
                    text={card.text}
                    emptyFallback="텍스트 없음"
                    collapsedLines={presentationLargeCards ? 8 : 5}
                    className={`select-text whitespace-pre-wrap text-[var(--theme-card-text)] ${cardTextClass}`}
                  />
                  <CardAttachments
                    attachments={toCardAttachmentViewModel(card)}
                    mode="teacher"
                    stopPropagation
                    className="mt-2"
                  />
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 text-[var(--theme-card-muted-text)] ${metaTextClass}`}
                  >
                    <span>{authorLabel}</span>
                    <span>{formatCardDate(card.created_at)}</span>
                  </div>
                </SortableCardItem>
              );
                })}
              </div>
              </SortableContext>
              {virtualWindow.bottomSpacer > 0 ? (
                <div aria-hidden style={{ height: virtualWindow.bottomSpacer }} />
              ) : null}
            </>
          ) : (
            <>
              {virtualWindow.topSpacer > 0 ? <div aria-hidden style={{ height: virtualWindow.topSpacer }} /> : null}
              <SortableContext items={cardItems} strategy={verticalListSortingStrategy}>
              <div className={stackGapClass}>
                {visibleCards.map((card) => {
              const authorLabel = card.student?.authorLabel || card.author_name || "익명";
              const token = normalizeCardColorTone(card.card_color_token);
              const cardToneClass = token === "default" ? "border-[var(--theme-border)]" : "";

              const liftClass =
                dragReadyCardId === card.id
                  ? "animate-[wiggle_0.22s_ease-in-out_infinite_alternate] scale-[0.985] shadow-lg"
                  : draggingCardId === card.id
                    ? "scale-[0.96] opacity-90 shadow-xl"
                    : "";

              return (
                <SortableCardItem
                  key={card.id}
                  card={card}
                  wallId={wall.id}
                  disabled={!canDragCard?.(card.id)}
                  draggingCardId={draggingCardId}
                  dragReadyCardId={dragReadyCardId}
                  variant={presentationLargeCards ? "present" : "default"}
                  selected={card.id === selectedCardId}
                  onCardHoldStart={onCardHoldStart}
                  onCardHoldEnd={onCardHoldEnd}
                  className={`w-full max-w-full self-stretch pt-10 transform-gpu will-change-transform ${role === "student" ? "gap-3.5" : ""} ${cardToneClass} ${liftClass}`}
                  onClick={() => {
                    if (hasTextSelection()) return;
                    onSelectCard?.(card.id, wall.id);
                  }}
                >
                  {card.student?.isOwnCard ? (
                    <StudentOwnedCardMenu
                      card={card}
                      draggingCardId={draggingCardId}
                      isOpen={openStudentMenuCardId === card.id}
                      onOpenChange={(next) => setOpenStudentMenuCardId(next ? card.id : null)}
                    />
                  ) : null}
                  <CollapsibleCardText
                    text={card.text || card.student?.title || ""}
                    emptyFallback="텍스트 없음"
                    collapsedLines={presentationLargeCards ? 8 : 5}
                    className={`select-text whitespace-pre-wrap text-[var(--theme-text)] ${cardTextClass}`}
                    linkClassName="text-[var(--theme-accent)] underline underline-offset-2 decoration-2 hover:text-[var(--theme-accent-strong)]"
                  />
                  <CardAttachments
                    attachments={toCardAttachmentViewModel(card)}
                    mode="teacher"
                    stopPropagation
                    className="mt-2"
                  />
                  <CardAttachments
                    attachments={(card.student?.attachments ?? []).map((attachment) => ({
                      id: attachment.id,
                      type: attachment.type === "file" ? "file" : "url",
                      label: attachment.label,
                      url: attachment.url,
                      contentType: attachment.contentType,
                    }))}
                    mode="student"
                    disabledReason="학생 화면에서는 첨부를 제거할 수 없어요."
                    className="mt-2"
                  />
                  <div
                    data-student-card-meta="true"
                    className={`flex flex-wrap items-center justify-between gap-2 text-[var(--theme-text-muted)] ${metaTextClass}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {authorLabel}
                      {card.student?.isOwnCard ? (
                        <span data-testid="student-owned-card-badge" className="rounded-full border border-[var(--theme-owner-badge-border)] bg-[var(--theme-owner-badge-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--theme-owner-badge-text)] shadow-sm ring-1 ring-[var(--theme-card)]/80">
                          내 카드
                        </span>
                      ) : null}
                    </span>
                    <span>{formatCardDate(card.created_at)}</span>
                  </div>
                  {card.student?.deleteError ? (
                    <p className="mt-2 text-xs font-semibold text-[var(--theme-danger)]">{card.student.deleteError}</p>
                  ) : null}
                </SortableCardItem>
              );
                })}
              </div>
              </SortableContext>
              {virtualWindow.bottomSpacer > 0 ? (
                <div aria-hidden style={{ height: virtualWindow.bottomSpacer }} />
              ) : null}
            </>
          )}
        </div>
        <div className={`shrink-0 ${role === "student" ? "px-3" : "px-4 pr-3"} pb-3 pt-1`}>
          <button
            type="button"
            onClick={() => onAddCard(wall.id)}
            data-testid="guest-card-compose-cta"
            disabled={addDisabled}
            aria-label="카드 작성"
            className="group/compose flex w-full items-center justify-between gap-3 rounded-md border-2 border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-4 py-3 text-left text-sm text-[var(--theme-text-muted)] shadow-sm transition hover:bg-[var(--theme-surface-muted)] hover:text-[var(--theme-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-card)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="font-semibold text-[var(--theme-text)]">+ 카드 작성</span>
            <span className="text-xs font-medium text-[var(--theme-text-muted)]">내용·파일 올리기</span>
          </button>
          {addDisabled && addDisabledMessage ? (
            <p className="mt-2 text-xs text-[var(--theme-text-subtle)]">{addDisabledMessage}</p>
          ) : null}
        </div>
      </div>
    </section>
  );

  const commitResizedWidth = (nextWidth: number) => {
    if (!onResizeStop) return;
    onResizeStop(wall.id, clampWallWidth(nextWidth));
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      commitResizedWidth(getAdjacentWallWidth(wall.ui_width_px, "left"));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      commitResizedWidth(getAdjacentWallWidth(wall.ui_width_px, "right"));
    }
  };

  if (!isResizable || !onResizeStop) {
    return content;
  }

  return (
    <Resizable
      enable={{ right: true }}
      minWidth={MIN_WALL_WIDTH}
      maxWidth={MAX_WALL_WIDTH}
      size={{ width: wall.ui_width_px, height: "100%" }}
      handleComponent={{
        right: (
          <div
            className="group absolute -right-[15px] top-0 flex h-full w-6 cursor-col-resize items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
            title={`폭: ${wall.ui_width_px}px`}
            role="separator"
            tabIndex={0}
            aria-label="섹션 폭 조절"
            aria-orientation="vertical"
            aria-valuemin={MIN_WALL_WIDTH}
            aria-valuemax={MAX_WALL_WIDTH}
            aria-valuenow={clampWallWidth(wall.ui_width_px)}
            onDoubleClick={() => commitResizedWidth(DEFAULT_WALL_WIDTH)}
            onKeyDown={handleResizeKeyDown}
          >
            <span className="absolute inset-y-3 w-px rounded-full bg-[var(--theme-border-strong)] opacity-0 transition group-hover:opacity-100" />
          </div>
        ),
      }}
      onResizeStop={(_event, _direction, ref) => {
        commitResizedWidth(ref.offsetWidth);
      }}
    >
      {content}
    </Resizable>
  );
}

export default memo(WallColumn);
