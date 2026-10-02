"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction,
} from "react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CardDetailOverlayWithQuery } from "@/app/_components/CardDetailOverlay";
import InlineAlert from "@/app/_components/InlineAlert";
import type { Card } from "@/lib/data/cards";
import type { CardFile } from "@/lib/data/files";
import type { BoardRole } from "@/lib/auth/boardRoles";
import type { BoardTag } from "@/lib/data/tags";
import type { FollowMode } from "@/lib/present/followState";
import { normalizeExternalAttachments } from "@/lib/types/attachments";
import { resolveCardAnchor, scrollToCard } from "@/lib/board/scrollToCard";
import { scrollToSection } from "@/lib/board/scrollToSection";

import { applyReorderedSubset } from "./reorderUtils";
import { exportSelectedCardsAsJson } from "./BulkActionsBar";
import ActivityPanel, { type ActivityFilter } from "./ActivityPanel";
import CardListBody from "./CardListBody";
import CardListHeader from "./CardListHeader";
import CommandPalette from "./CommandPalette";
import TagRulesPanel from "./TagRulesPanel";
import TriagePanel from "./_components/TriagePanel";
import useCardListDerived from "./useCardListDerived";
import useHistoryState from "./useHistoryState";
import useReorderList from "./useReorderList";
import useClassMode from "./useClassMode";
import {
  getModeDefaults,
  type ClassMode,
  CLASS_MODE_LABELS,
} from "./classModes";
import useBoardPolicy from "../useBoardPolicy";
import useSavedViews, { type SavedView, type ViewState } from "./useSavedViews";
import useUiPrefs, { type ClassUiPrefs } from "./useUiPrefs";
import { useCommandPalette } from "./useCommandPalette";
import {
  buildBulkActionSuccessMessage,
  runBulkCardAction,
} from "./bulkCardActions";
import useSelection from "./useSelection";
import { formatKeySpecList, keymapMatchesEvent } from "./keymapUtils";
import {
  buildCardJumpPaletteItems,
  shouldBuildCardJumpList,
} from "@/lib/ui/paletteJump";

type FilesByCard = Record<string, CardFile[]>;
type SearchParams = Record<string, string | undefined>;

type CardListHistoryState = {
  isSortMode: boolean;
  isSelectionMode: boolean;
  selectedIds: string[];
  order: {
    featured: string[];
    pinned: string[];
    normal: string[];
  };
  searchQuery: string;
  showSelectedOnly: boolean;
  tagsFilter: string[];
  showInboxOnly: boolean;
  activeCardId: string | null;
  classMode: ClassMode;
};

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "전체",
  card: "카드",
  collab: "협업",
  trash: "휴지통",
  mine: "내 활동",
};

const CARD_JUMP_BUILD_DEBOUNCE_MS = 150;
const STUDENT_BOARD_AUTO_REFRESH_INTERVAL_MS = 45_000;
const STUDENT_BOARD_AUTO_REFRESH_MIN_INTERVAL_MS = 15_000;

function areArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function normalizeCardAttachments(card: Card): Card {
  return {
    ...card,
    external_attachments: normalizeExternalAttachments(
      card.external_attachments,
    ),
  };
}

export default function CardListSection({
  boardId,
  wallId,
  featuredCards,
  pinnedCards,
  normalCards,
  filesByCard,
  writeLocked,
  initialCardId,
  currentSearchParams,
  pageLimit,
  nextOffset,
  offset,
  boardRole,
  tags,
}: {
  boardId: string;
  wallId: string;
  featuredCards: Card[];
  pinnedCards: Card[];
  normalCards: Card[];
  filesByCard: FilesByCard;
  writeLocked: boolean;
  initialCardId?: string;
  currentSearchParams: SearchParams;
  pageLimit: number;
  nextOffset: number | null;
  offset: number;
  boardRole: BoardRole | null;
  tags: BoardTag[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<BoardTag[]>(tags);
  const [isSortMode, setIsSortMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showInboxOnly, setShowInboxOnly] = useState(false);
  const {
    mode: classMode,
    setMode: setClassMode,
    isReady: classModeReady,
  } = useClassMode(boardId, "collect");
  const [isViewPopoverOpen, setIsViewPopoverOpen] = useState(false);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [isTagRulesOpen, setIsTagRulesOpen] = useState(false);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const [isUiPrefsOpen, setIsUiPrefsOpen] = useState(false);
  const [modeNotice, setModeNotice] = useState<null | {
    message: string;
    id: number;
  }>(null);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(
    null,
  );
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const selectedCardId = searchParams.get("card");
  const activeViewParam = searchParams.get("view");
  const safeQuery = searchParams.get("safe");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const appliedSafeQueryRef = useRef(false);

  const [featuredOrder, setFeaturedOrder] = useState(() =>
    featuredCards.map(normalizeCardAttachments),
  );
  const [pinnedOrder, setPinnedOrder] = useState(() =>
    pinnedCards.map(normalizeCardAttachments),
  );
  const [normalOrder, setNormalOrder] = useState(() =>
    normalCards.map(normalizeCardAttachments),
  );
  const [paletteMessage, setPaletteMessage] = useState<null | {
    tone: "success" | "error";
    text: string;
  }>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const modeNoticeTimeoutRef = useRef<number | null>(null);
  const lastModeNoticeRef = useRef<{ message: string; at: number } | null>(
    null,
  );
  const lastNonPresentModeRef = useRef<ClassMode>("collect");
  const appliedModeRef = useRef<ClassMode | null>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const isApplyingHistoryRef = useRef(false);
  const suppressSearchHistoryRef = useRef(false);
  const shouldRecordFocusRef = useRef(false);
  const pendingActiveCardIdRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const isApplyingViewRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const appliedDefaultViewRef = useRef(false);
  const followDebounceRef = useRef<number | null>(null);
  const pendingFollowRef = useRef<{
    mode: FollowMode;
    focusedCardId: string | null;
  } | null>(null);
  const { policy } = useBoardPolicy(boardId);

  const canSoftDelete =
    boardRole === "owner" ||
    (boardRole === "editor" && policy.editorsCanSoftDelete);
  const canManageTrash =
    boardRole === "owner" ||
    (boardRole === "editor" && policy.editorsCanManageTrash);
  const canEditTags = boardRole === "owner" || boardRole === "editor";
  const softDeleteMessage = canSoftDelete
    ? null
    : "보드 정책으로 삭제가 제한되어 있어요.";
  const trashAccessMessage = canManageTrash
    ? null
    : "보드 정책으로 휴지통 접근이 차단되었습니다.";

  const router = useRouter();
  useEffect(() => {
    const shouldSkipRefresh = () => {
      if (typeof document === "undefined") {
        return true;
      }

      if (document.visibilityState !== "visible") {
        return true;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return true;
      }

      return false;
    };

    const refreshVisibleBoard = () => {
      if (shouldSkipRefresh()) {
        return;
      }

      const now = Date.now();
      if (
        now - autoRefreshLastAtRef.current <
        STUDENT_BOARD_AUTO_REFRESH_MIN_INTERVAL_MS
      ) {
        return;
      }

      autoRefreshLastAtRef.current = now;
      router.refresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshVisibleBoard();
      }
    };

    window.addEventListener("focus", refreshVisibleBoard);
    window.addEventListener("pageshow", refreshVisibleBoard);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(
      refreshVisibleBoard,
      STUDENT_BOARD_AUTO_REFRESH_INTERVAL_MS,
    );

    return () => {
      window.removeEventListener("focus", refreshVisibleBoard);
      window.removeEventListener("pageshow", refreshVisibleBoard);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [router]);
  const autoRefreshLastAtRef = useRef(0);
  const trashHref = useMemo(
    () => `/dashboard/boards/${boardId}/board`,
    [boardId],
  );
  const toggleActivityPanel = useCallback(
    () => setIsActivityPanelOpen((prev) => !prev),
    [],
  );
  const openActivityPanelWithFilter = useCallback(
    (nextFilter: ActivityFilter) => {
      setActivityFilter(nextFilter);
      setIsActivityPanelOpen(true);
    },
    [],
  );
  useEffect(() => {
    setFeaturedOrder(featuredCards.map(normalizeCardAttachments));
  }, [featuredCards]);

  useEffect(() => {
    setPinnedOrder(pinnedCards.map(normalizeCardAttachments));
  }, [pinnedCards]);

  useEffect(() => {
    setNormalOrder(normalCards.map(normalizeCardAttachments));
  }, [normalCards]);

  useEffect(() => {
    setAvailableTags(tags);
  }, [tags]);

  const orderedCards = useMemo(
    () => [...featuredOrder, ...pinnedOrder, ...normalOrder],
    [featuredOrder, normalOrder, pinnedOrder],
  );
  const orderedCardIds = useMemo(
    () => orderedCards.map((card) => card.id),
    [orderedCards],
  );

  const selection = useSelection(orderedCardIds);
  const selectedIdsSorted = useMemo(
    () => [...selection.selectedIdList].sort(),
    [selection.selectedIdList],
  );
  const markUserInteraction = useCallback(() => {
    if (isApplyingViewRef.current) {
      return;
    }
    hasUserInteractedRef.current = true;
    setActiveViewId(null);
  }, []);

  const {
    normalizedImmediateSearchTerm,
    isSearchDeferred,
    visibleFeaturedCards,
    visiblePinnedCards,
    visibleNormalCards,
    filteredCardsCount,
    isFiltered,
    hasFilteredResults,
  } = useCardListDerived({
    orderedCards,
    featuredOrder,
    pinnedOrder,
    normalOrder,
    filesByCard,
    searchTerm,
    showSelectedOnly,
    selectedIds: selectedIdsSorted,
    tagsFilter,
    showInboxOnly,
  });

  const buildOrderState = useCallback(
    (orders: { featured: Card[]; pinned: Card[]; normal: Card[] }) => ({
      featured: orders.featured.map((card) => card.id),
      pinned: orders.pinned.map((card) => card.id),
      normal: orders.normal.map((card) => card.id),
    }),
    [],
  );

  const initialHistoryState = useMemo<CardListHistoryState>(
    () => ({
      isSortMode: false,
      isSelectionMode: false,
      selectedIds: [],
      order: buildOrderState({
        featured: featuredCards,
        pinned: pinnedCards,
        normal: normalCards,
      }),
      searchQuery: "",
      showSelectedOnly: false,
      tagsFilter: [],
      showInboxOnly: false,
      activeCardId: selectedCardId ?? null,
      classMode,
    }),
    [
      buildOrderState,
      classMode,
      featuredCards,
      normalCards,
      pinnedCards,
      selectedCardId,
    ],
  );

  const { canRedo, canUndo, jumpToPast, past, present, push, redo, undo } =
    useHistoryState(initialHistoryState, { maxDepth: 10 });

  const pushOrderHistory = useCallback(
    (nextOrder: CardListHistoryState["order"]) => {
      if (isApplyingHistoryRef.current) {
        return;
      }
      push(
        {
          ...present.state,
          order: nextOrder,
        },
        { label: "정렬 변경" },
      );
    },
    [present.state, push],
  );

  const handleReorder: (
    section: "featured" | "pinned" | "normal",
    updater: Dispatch<SetStateAction<Card[]>>,
  ) => (previous: Card[], next: Card[]) => void = useCallback(
    (
      section: "featured" | "pinned" | "normal",
      updater: Dispatch<SetStateAction<Card[]>>,
    ) =>
      (_previous: Card[], next: Card[]) => {
        updater((current) => {
          const nextOrder = applyReorderedSubset(current, next);
          const orderOverrides = buildOrderState({
            featured: section === "featured" ? nextOrder : featuredOrder,
            pinned: section === "pinned" ? nextOrder : pinnedOrder,
            normal: section === "normal" ? nextOrder : normalOrder,
          });
          pushOrderHistory(orderOverrides);
          return nextOrder;
        });
      },
    [
      buildOrderState,
      featuredOrder,
      normalOrder,
      pinnedOrder,
      pushOrderHistory,
    ],
  );

  const featuredReorder = useReorderList({
    items: visibleFeaturedCards,
    enabled: isSortMode,
    onReorder: handleReorder("featured", setFeaturedOrder),
  });
  const pinnedReorder = useReorderList({
    items: visiblePinnedCards,
    enabled: isSortMode,
    onReorder: handleReorder("pinned", setPinnedOrder),
  });
  const normalReorder = useReorderList({
    items: visibleNormalCards,
    enabled: isSortMode,
    onReorder: handleReorder("normal", setNormalOrder),
  });
  const reorderFeaturedCards = featuredReorder.items;
  const reorderPinnedCards = pinnedReorder.items;
  const reorderNormalCards = normalReorder.items;

  const reorderVisibleCardIds = useMemo(
    () => [
      ...reorderFeaturedCards.map((card) => card.id),
      ...reorderPinnedCards.map((card) => card.id),
      ...reorderNormalCards.map((card) => card.id),
    ],
    [reorderFeaturedCards, reorderNormalCards, reorderPinnedCards],
  );
  const reorderIndexById = useMemo(
    () => new Map(reorderVisibleCardIds.map((id, index) => [id, index])),
    [reorderVisibleCardIds],
  );

  const applyOrderIds = useCallback(
    (orderIds: string[], fallback: Card[]) => {
      const map = new Map(orderedCards.map((card) => [card.id, card]));
      const resolved = orderIds
        .map((id) => map.get(id))
        .filter(Boolean) as Card[];
      if (resolved.length > 0) {
        return resolved;
      }
      return fallback;
    },
    [orderedCards],
  );

  const applyHistoryState = useCallback(
    (state: CardListHistoryState) => {
      isApplyingHistoryRef.current = true;
      shouldRecordFocusRef.current = false;
      if (state.classMode && state.classMode !== classMode) {
        appliedModeRef.current = null;
        setClassMode(state.classMode);
        if (state.classMode !== "present") {
          lastNonPresentModeRef.current = state.classMode;
        }
      }
      setIsSortMode(state.isSortMode);
      setIsSelectionMode(state.isSelectionMode);
      setSearchTerm(state.searchQuery);
      setTagsFilter(state.tagsFilter);
      setShowSelectedOnly(
        state.isSelectionMode ? state.showSelectedOnly : false,
      );
      setShowInboxOnly(state.showInboxOnly);
      pendingActiveCardIdRef.current = state.activeCardId;
      if (state.isSelectionMode) {
        selection.setSelectionIds(state.selectedIds);
      } else {
        selection.clearSelection();
      }
      setFeaturedOrder((current) =>
        applyOrderIds(state.order.featured, current),
      );
      setPinnedOrder((current) => applyOrderIds(state.order.pinned, current));
      setNormalOrder((current) => applyOrderIds(state.order.normal, current));
      window.setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 0);
    },
    [applyOrderIds, classMode, selection, setClassMode],
  );

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tagName = target.tagName.toLowerCase();
    return (
      target.isContentEditable ||
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select"
    );
  }, []);

  const hasOpenDialog = useCallback(
    () => Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
    [],
  );

  useEffect(() => {
    if (isSortMode) {
      setIsSelectionMode(false);
    }
  }, [isSortMode]);

  useEffect(() => {
    if (!isSelectionMode) {
      selection.clearSelection();
    }
  }, [isSelectionMode, selection]);

  useEffect(
    () => () => {
      if (modeNoticeTimeoutRef.current) {
        window.clearTimeout(modeNoticeTimeoutRef.current);
      }
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      if (followDebounceRef.current) {
        window.clearTimeout(followDebounceRef.current);
      }
    },
    [],
  );

  const activeCardId = reorderVisibleCardIds[activeIndex] ?? null;
  const orderState = useMemo(
    () =>
      buildOrderState({
        featured: featuredOrder,
        pinned: pinnedOrder,
        normal: normalOrder,
      }),
    [buildOrderState, featuredOrder, normalOrder, pinnedOrder],
  );
  const currentHistoryState = useMemo<CardListHistoryState>(
    () => ({
      isSortMode,
      isSelectionMode,
      selectedIds: selectedIdsSorted,
      order: orderState,
      searchQuery: searchTerm,
      showSelectedOnly,
      tagsFilter,
      showInboxOnly,
      activeCardId,
      classMode,
    }),
    [
      activeCardId,
      isSelectionMode,
      isSortMode,
      orderState,
      searchTerm,
      classMode,
      selectedIdsSorted,
      showInboxOnly,
      showSelectedOnly,
      tagsFilter,
    ],
  );

  const pushHistoryState = useCallback(
    (
      overrides: Partial<CardListHistoryState>,
      options: { label: string; mergeKey?: string; mergeWindowMs?: number },
    ) => {
      if (isApplyingHistoryRef.current) {
        return;
      }
      push(
        {
          ...currentHistoryState,
          ...overrides,
        },
        options,
      );
    },
    [currentHistoryState, push],
  );

  const showModeNotice = useCallback((message: string) => {
    const now = Date.now();
    if (
      lastModeNoticeRef.current?.message === message &&
      now - lastModeNoticeRef.current.at < 2500
    ) {
      return;
    }
    lastModeNoticeRef.current = { message, at: now };
    setModeNotice({ message, id: now });
    if (modeNoticeTimeoutRef.current) {
      window.clearTimeout(modeNoticeTimeoutRef.current);
    }
    modeNoticeTimeoutRef.current = window.setTimeout(() => {
      setModeNotice(null);
    }, 2000);
  }, []);

  useEffect(() => {
    if (reorderVisibleCardIds.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (pendingActiveCardIdRef.current !== null) {
      const targetId = pendingActiveCardIdRef.current;
      const nextIndex = targetId ? reorderVisibleCardIds.indexOf(targetId) : -1;
      setActiveIndex(nextIndex === -1 ? 0 : nextIndex);
      pendingActiveCardIdRef.current = null;
      return;
    }
    const selectedIndex = selectedCardId
      ? reorderVisibleCardIds.indexOf(selectedCardId)
      : -1;
    if (selectedIndex !== -1) {
      setActiveIndex(selectedIndex);
      return;
    }
    setActiveIndex((prev) => Math.min(prev, reorderVisibleCardIds.length - 1));
  }, [reorderVisibleCardIds, selectedCardId]);

  useEffect(() => {
    if (!activeCardId) {
      return;
    }
    const node = cardRefs.current.get(activeCardId);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeCardId]);

  useEffect(() => {
    if (!shouldRecordFocusRef.current || isApplyingHistoryRef.current) {
      return;
    }
    shouldRecordFocusRef.current = false;
    if (present.state.activeCardId === activeCardId) {
      return;
    }
    pushHistoryState(
      { activeCardId },
      {
        label: "포커스 이동",
        mergeKey: "focus",
        mergeWindowMs: 400,
      },
    );
  }, [activeCardId, present.state.activeCardId, pushHistoryState]);

  const sendFollowUpdate = useCallback(
    async (payload: { mode: FollowMode; focusedCardId: string | null }) => {
      try {
        const response = await fetch(
          apiV1Path(`boards/${boardId}/present/state`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              boardId,
              wallId,
              focusedCardId: payload.focusedCardId,
              mode: payload.mode,
            }),
          },
        );
        if (!response.ok) {
          throw new Error("failed");
        }
        setFollowError(null);
      } catch (error) {
        console.error("present follow update failed", error);
        setFollowError(
          "프로젝터 따라가기를 업데이트하지 못했습니다. 다음 이동 시 다시 시도해 주세요.",
        );
      }
    },
    [boardId, wallId],
  );

  const scheduleFollowUpdate = useCallback(
    (payload: { mode: FollowMode; focusedCardId: string | null }) => {
      if (!followEnabled || classMode !== "present") {
        return;
      }
      pendingFollowRef.current = payload;
      if (followDebounceRef.current) {
        window.clearTimeout(followDebounceRef.current);
      }
      followDebounceRef.current = window.setTimeout(() => {
        const next = pendingFollowRef.current;
        followDebounceRef.current = null;
        if (!next) {
          return;
        }
        void sendFollowUpdate(next);
      }, 300);
    },
    [classMode, followEnabled, sendFollowUpdate],
  );

  useEffect(() => {
    if (!followEnabled || classMode !== "present") {
      return;
    }
    const payload = {
      mode: activeCardId ? ("focus" as const) : ("grid" as const),
      focusedCardId: activeCardId ?? null,
    };
    scheduleFollowUpdate(payload);
  }, [activeCardId, classMode, followEnabled, scheduleFollowUpdate]);

  useEffect(() => {
    if (classMode !== "present" && followEnabled) {
      setFollowEnabled(false);
      pendingFollowRef.current = null;
      if (followDebounceRef.current) {
        window.clearTimeout(followDebounceRef.current);
        followDebounceRef.current = null;
      }
      void sendFollowUpdate({ mode: "grid", focusedCardId: null });
    }
  }, [classMode, followEnabled, sendFollowUpdate]);

  const handleToggleFollow = useCallback(() => {
    if (classMode !== "present") {
      setFollowEnabled(false);
      return;
    }
    setFollowEnabled((prev) => {
      const next = !prev;
      const payload = next
        ? {
            mode: activeCardId
              ? ("focus" as FollowMode)
              : ("grid" as FollowMode),
            focusedCardId: activeCardId ?? null,
          }
        : { mode: "grid" as FollowMode, focusedCardId: null };
      pendingFollowRef.current = payload;
      if (followDebounceRef.current) {
        window.clearTimeout(followDebounceRef.current);
        followDebounceRef.current = null;
      }
      void sendFollowUpdate(payload);
      if (!next) {
        setFollowError(null);
      }
      return next;
    });
  }, [activeCardId, classMode, sendFollowUpdate]);

  const cardsIndex = useMemo(
    () =>
      orderedCards.map((card) => ({
        id: card.id,
        text: card.text,
        authorName: card.author_name,
        authorType: card.author_type,
        createdAt: card.created_at,
        isHidden: card.is_hidden,
        isPinned: card.is_pinned,
        isFeatured: card.is_featured,
        cardColorToken: card.card_color_token,
        files: (filesByCard[card.id] ?? []).map((file) => ({
          id: file.id,
          filename: file.filename,
          contentType: file.content_type,
          sizeBytes: file.size_bytes,
          downloadUrl: apiV1Path(`files/${file.id}/download`),
        })),
        externalAttachments: card.external_attachments,
      })),
    [filesByCard, orderedCards],
  );

  const selectedCards = useMemo(
    () =>
      orderedCards
        .filter((card) => selection.isSelected(card.id))
        .map((card) => ({
          id: card.id,
          text: card.text,
          authorName: card.author_name,
          authorType: card.author_type,
          createdAt: card.created_at,
          isHidden: card.is_hidden,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          externalAttachments: card.external_attachments,
          tags: card.tags,
        })),
    [orderedCards, selection],
  );

  const buildCardHref = useCallback(
    (cardId: string) => {
      const params = new URLSearchParams();
      Object.entries(currentSearchParams).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      params.set("card", cardId);
      return `?${params.toString()}`;
    },
    [currentSearchParams],
  );

  const buildPageHref = useCallback(
    (nextPageOffset?: number | null) => {
      const params = new URLSearchParams();
      Object.entries(currentSearchParams).forEach(([key, value]) => {
        if (value && key !== "offset" && key !== "card") {
          params.set(key, value);
        }
      });
      if (nextPageOffset) {
        params.set("offset", String(nextPageOffset));
      }
      return `?${params.toString()}`;
    },
    [currentSearchParams],
  );

  const prevOffset = offset > 0 ? Math.max(0, offset - pageLimit) : null;
  const canOpenTrash = canManageTrash;

  const setActiveIndexWithHistory = useCallback((nextIndex: number) => {
    shouldRecordFocusRef.current = true;
    setActiveIndex(nextIndex);
  }, []);

  const focusNextCard = useCallback(() => {
    const total = reorderVisibleCardIds.length;
    if (total === 0) {
      return;
    }
    const nextIndex = Math.min(total - 1, activeIndex + 1);
    setActiveIndexWithHistory(nextIndex);
  }, [activeIndex, reorderVisibleCardIds.length, setActiveIndexWithHistory]);

  const focusPrevCard = useCallback(() => {
    const total = reorderVisibleCardIds.length;
    if (total === 0) {
      return;
    }
    const nextIndex = Math.max(0, activeIndex - 1);
    setActiveIndexWithHistory(nextIndex);
  }, [activeIndex, reorderVisibleCardIds.length, setActiveIndexWithHistory]);

  const focusCardFromActivity = useCallback(
    (cardId: string) => {
      const node = cardRefs.current.get(cardId);
      if (!node) {
        return { ok: false } as const;
      }
      const result = scrollToCard(cardId, {
        block: "center",
        behavior: "smooth",
        highlightClassName: "ring-2 ring-amber-200",
        highlightDurationMs: 2000,
      });
      if (!result.ok) {
        return { ok: false } as const;
      }
      setActiveIndexWithHistory(reorderIndexById.get(cardId) ?? 0);
      setHighlightedCardId(cardId);
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(
        () => setHighlightedCardId(null),
        2000,
      );
      router.push(buildCardHref(cardId));
      return { ok: true } as const;
    },
    [buildCardHref, reorderIndexById, router, setActiveIndexWithHistory],
  );

  const commitSearchHistory = useCallback(
    (nextValue: string) => {
      if (present.state.searchQuery === nextValue) {
        return;
      }
      pushHistoryState(
        { searchQuery: nextValue },
        {
          label: nextValue ? "검색어 변경" : "검색어 초기화",
          mergeKey: "search",
          mergeWindowMs: 800,
        },
      );
    },
    [present.state.searchQuery, pushHistoryState],
  );

  const handleSearchChange = (value: string) => {
    markUserInteraction();
    setSearchTerm(value);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearchTerm("");
      commitSearchHistory("");
    }
    if (event.key === "Enter") {
      commitSearchHistory(searchTerm);
    }
  };

  useEffect(() => {
    if (isApplyingHistoryRef.current) {
      return;
    }
    if (suppressSearchHistoryRef.current) {
      suppressSearchHistoryRef.current = false;
      return;
    }
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = window.setTimeout(() => {
      commitSearchHistory(searchTerm);
    }, 500);
  }, [commitSearchHistory, searchTerm]);

  const toggleTagFilter = useCallback(
    (tagId: string) => {
      markUserInteraction();
      setTagsFilter((prev) => {
        const has = prev.includes(tagId);
        const next = has ? prev.filter((id) => id !== tagId) : [...prev, tagId];
        pushHistoryState(
          { tagsFilter: next },
          {
            label: has ? "태그 필터 제거" : "태그 필터 추가",
            mergeKey: "tag-filter",
            mergeWindowMs: 800,
          },
        );
        return next;
      });
    },
    [markUserInteraction, pushHistoryState],
  );

  const clearTagFilter = useCallback(() => {
    markUserInteraction();
    setTagsFilter((prev) => {
      if (prev.length === 0) return prev;
      pushHistoryState({ tagsFilter: [] }, { label: "태그 필터 초기화" });
      return [];
    });
  }, [markUserInteraction, pushHistoryState]);

  const handleClassModeChange = useCallback(
    (nextMode: ClassMode) => {
      appliedModeRef.current = null;
      setClassMode(nextMode);
      pushHistoryState(
        { classMode: nextMode },
        { label: `모드: ${CLASS_MODE_LABELS[nextMode]}` },
      );
      if (nextMode !== "present") {
        lastNonPresentModeRef.current = nextMode;
      }
    },
    [pushHistoryState, setClassMode],
  );

  const exitPresentMode = useCallback(() => {
    const nextMode = lastNonPresentModeRef.current || "collect";
    handleClassModeChange(nextMode);
  }, [handleClassModeChange]);

  const handleToggleSortMode = useCallback(() => {
    const nextSortMode = !isSortMode;
    const nextSelectionMode = nextSortMode ? false : isSelectionMode;
    setIsSortMode(nextSortMode);
    if (nextSortMode && classMode === "present") {
      showModeNotice("발표 모드: 정렬을 켜면 조작에 주의해 주세요.");
    }
    if (nextSortMode && isSelectionMode) {
      showModeNotice("정렬 모드에서는 선택 모드를 사용할 수 없어요.");
      selection.clearSelection();
    }
    setIsSelectionMode(nextSelectionMode);
    if (!nextSelectionMode) {
      setShowSelectedOnly(false);
    }
    pushHistoryState(
      {
        isSortMode: nextSortMode,
        isSelectionMode: nextSelectionMode,
        selectedIds: nextSelectionMode ? selectedIdsSorted : [],
        showSelectedOnly: nextSelectionMode ? showSelectedOnly : false,
      },
      { label: nextSortMode ? "정렬 모드 시작" : "정렬 모드 종료" },
    );
  }, [
    classMode,
    isSelectionMode,
    isSortMode,
    pushHistoryState,
    selectedIdsSorted,
    selection,
    showModeNotice,
    showSelectedOnly,
  ]);

  const handleToggleSelectionMode = useCallback(() => {
    const nextSelectionMode = !isSelectionMode;
    const nextSortMode = nextSelectionMode ? false : isSortMode;
    setIsSelectionMode(nextSelectionMode);
    if (nextSelectionMode && classMode === "present") {
      showModeNotice("발표 모드: 선택 기능을 켜면 실수 입력에 주의하세요.");
    }
    if (nextSelectionMode && isSortMode) {
      showModeNotice("선택 모드에서는 정렬 모드를 사용할 수 없어요.");
      setIsSortMode(false);
    } else {
      setIsSortMode(nextSortMode);
    }
    if (!nextSelectionMode) {
      selection.clearSelection();
      setShowSelectedOnly(false);
    }
    pushHistoryState(
      {
        isSortMode: nextSortMode,
        isSelectionMode: nextSelectionMode,
        selectedIds: nextSelectionMode ? selectedIdsSorted : [],
        showSelectedOnly: nextSelectionMode ? showSelectedOnly : false,
      },
      { label: nextSelectionMode ? "선택 모드 시작" : "선택 모드 종료" },
    );
  }, [
    classMode,
    isSelectionMode,
    isSortMode,
    pushHistoryState,
    selectedIdsSorted,
    selection,
    showModeNotice,
    showSelectedOnly,
  ]);

  const handleToggleShowSelectedOnly = useCallback(() => {
    if (!isSelectionMode) {
      return;
    }
    markUserInteraction();
    const nextValue = !showSelectedOnly;
    setShowSelectedOnly(nextValue);
    pushHistoryState(
      { showSelectedOnly: nextValue },
      { label: nextValue ? "선택 카드만 보기" : "전체 카드 보기" },
    );
  }, [
    isSelectionMode,
    markUserInteraction,
    pushHistoryState,
    showSelectedOnly,
  ]);

  const handleToggleInboxOnly = useCallback(() => {
    markUserInteraction();
    const nextValue = !showInboxOnly;
    setShowInboxOnly(nextValue);
    pushHistoryState(
      { showInboxOnly: nextValue },
      { label: nextValue ? "Inbox만 보기" : "전체 카드 보기" },
    );
  }, [markUserInteraction, pushHistoryState, showInboxOnly]);

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }
    setFullscreenNotice(null);
    if (classMode !== "present") {
      setFullscreenNotice("전체화면은 발표 모드에서만 사용할 수 있어요.");
      return;
    }
    const root = document.documentElement;
    if (!root || !root.requestFullscreen) {
      setFullscreenNotice("전체화면을 지원하지 않는 브라우저예요.");
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreenNotice("전체화면 전환에 실패했어요.");
    }
  }, [classMode]);

  const lastSelectionRef = useRef<string[]>(selectedIdsSorted);

  useEffect(() => {
    if (!isSelectionMode || isApplyingHistoryRef.current) {
      lastSelectionRef.current = selectedIdsSorted;
      return;
    }
    if (areArraysEqual(lastSelectionRef.current, selectedIdsSorted)) {
      return;
    }
    lastSelectionRef.current = selectedIdsSorted;
    pushHistoryState(
      { selectedIds: selectedIdsSorted },
      {
        label:
          selectedIdsSorted.length > 0
            ? `선택 ${selectedIdsSorted.length}개`
            : "선택 해제",
        mergeKey: "selection",
        mergeWindowMs: 500,
      },
    );
  }, [isSelectionMode, pushHistoryState, selectedIdsSorted]);

  const handleUndo = useCallback(() => {
    const entry = undo();
    if (!entry) {
      return;
    }
    applyHistoryState(entry.state);
  }, [applyHistoryState, undo]);

  const handleRedo = useCallback(() => {
    const entry = redo();
    if (!entry) {
      return;
    }
    applyHistoryState(entry.state);
  }, [applyHistoryState, redo]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    if (classMode === "present") {
      return;
    }
    setFullscreenNotice(null);
    if (
      typeof document !== "undefined" &&
      document.fullscreenElement &&
      document.exitFullscreen
    ) {
      void document.exitFullscreen();
    }
  }, [classMode]);

  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const clearSearch = useCallback(() => {
    markUserInteraction();
    setSearchTerm("");
    commitSearchHistory("");
    focusSearchInput();
  }, [commitSearchHistory, focusSearchInput, markUserInteraction]);

  const applyViewState = useCallback(
    (state: ViewState) => {
      isApplyingViewRef.current = true;
      try {
        const nextShowSelectedOnly = false;
        suppressSearchHistoryRef.current = true;
        setSearchTerm(state.searchQuery);
        setTagsFilter(state.tagsFilter ?? []);
        setShowSelectedOnly(nextShowSelectedOnly);
        setShowInboxOnly(Boolean(state.inboxOnly));
        if (isSelectionMode) {
          selection.clearSelection();
        }
        if (isSelectionMode || isSortMode || state.showSelectedOnly) {
          showModeNotice("뷰 적용으로 모드가 해제되었습니다.");
        }
        setIsSelectionMode(false);
        setIsSortMode(false);
        pushHistoryState(
          {
            searchQuery: state.searchQuery,
            showSelectedOnly: nextShowSelectedOnly,
            isSelectionMode: false,
            isSortMode: false,
            selectedIds: [],
            tagsFilter: state.tagsFilter ?? [],
            showInboxOnly: Boolean(state.inboxOnly),
          },
          { label: "뷰 적용" },
        );
      } finally {
        isApplyingViewRef.current = false;
      }
    },
    [isSelectionMode, isSortMode, pushHistoryState, selection, showModeNotice],
  );

  const savedViews = useSavedViews({
    boardId,
    onApply: applyViewState,
  });
  const {
    views: savedViewList,
    applyView: applySavedView,
    addView: addSavedView,
    updateView: updateSavedView,
    deleteView: deleteSavedView,
    maxViews: maxSavedViews,
    notice: savedViewsNotice,
    retryRemote: retrySavedViews,
    isReady: savedViewsReady,
    defaultViewId: defaultSavedViewId,
  } = savedViews;
  const {
    prefs: uiPrefs,
    notice: uiPrefsNotice,
    updatePrefs,
    retryRemote: retryUiPrefs,
  } = useUiPrefs();
  const isSafeMode = uiPrefs.classSafeMode;

  const handleToggleSafeMode = useCallback(() => {
    updatePrefs({ classSafeMode: !uiPrefs.classSafeMode });
  }, [uiPrefs.classSafeMode, updatePrefs]);

  const applyModeDefaults = useCallback(
    (mode: ClassMode) => {
      if (isApplyingHistoryRef.current) {
        return;
      }
      const defaults = getModeDefaults(mode);
      if (defaults.disableSort && isSortMode) {
        setIsSortMode(false);
      }
      if (defaults.disableSelection && isSelectionMode) {
        setIsSelectionMode(false);
        setShowSelectedOnly(false);
        selection.clearSelection();
      }
      if (typeof defaults.inboxOnly === "boolean") {
        const nextInboxOnly = defaults.inboxOnly;
        setShowInboxOnly((current) => {
          if (current === nextInboxOnly) {
            return current;
          }
          pushHistoryState(
            { showInboxOnly: nextInboxOnly, classMode: mode },
            { label: `${CLASS_MODE_LABELS[mode]}: Inbox 토글` },
          );
          return nextInboxOnly;
        });
      }
      if (defaults.keyboardHints && !uiPrefs.showKeyboardHints) {
        updatePrefs({ showKeyboardHints: true });
      }
      if (
        mode === "present" &&
        (defaults.disableSort || defaults.disableSelection)
      ) {
        showModeNotice("발표 모드에 맞춰 정렬/선택이 기본 비활성화되었습니다.");
      }
      if (defaults.uiPrefs) {
        const uiPatch: Partial<ClassUiPrefs> = {};
        if (
          defaults.uiPrefs.density &&
          uiPrefs.density !== defaults.uiPrefs.density
        ) {
          uiPatch.density = defaults.uiPrefs.density;
        }
        if (
          typeof defaults.uiPrefs.textClampLines === "number" &&
          uiPrefs.textClampLines !== defaults.uiPrefs.textClampLines
        ) {
          uiPatch.textClampLines = defaults.uiPrefs.textClampLines;
        }
        if (
          typeof defaults.uiPrefs.showKeyboardHints === "boolean" &&
          uiPrefs.showKeyboardHints !== defaults.uiPrefs.showKeyboardHints
        ) {
          uiPatch.showKeyboardHints = defaults.uiPrefs.showKeyboardHints;
        }
        if (Object.keys(uiPatch).length > 0) {
          updatePrefs(uiPatch);
        }
      }
    },
    [
      isSelectionMode,
      isSortMode,
      pushHistoryState,
      selection,
      showModeNotice,
      uiPrefs.density,
      uiPrefs.showKeyboardHints,
      uiPrefs.textClampLines,
      updatePrefs,
    ],
  );

  useEffect(() => {
    if (safeQuery === null || appliedSafeQueryRef.current) {
      return;
    }
    appliedSafeQueryRef.current = true;
    const next = safeQuery === "1";
    if (uiPrefs.classSafeMode !== next) {
      updatePrefs({ classSafeMode: next });
    }
  }, [safeQuery, uiPrefs.classSafeMode, updatePrefs]);

  useEffect(() => {
    if (!isSafeMode) {
      return;
    }
    setIsActivityPanelOpen(false);
    setIsSortMode(false);
    setIsSelectionMode(false);
    setShowSelectedOnly(false);
  }, [isSafeMode]);

  useEffect(() => {
    if (!classModeReady) {
      return;
    }
    if (appliedModeRef.current === classMode) {
      return;
    }
    appliedModeRef.current = classMode;
    if (classMode !== "present") {
      lastNonPresentModeRef.current = classMode;
    }
    applyModeDefaults(classMode);
  }, [applyModeDefaults, classMode, classModeReady]);
  const keymap = uiPrefs.keymap;

  useEffect(() => {
    if (
      activeViewId &&
      !savedViewList.some((view) => view.id === activeViewId)
    ) {
      setActiveViewId(null);
    }
  }, [activeViewId, savedViewList]);
  const nextPinnedOrder = useCallback(() => {
    const pinned = savedViewList.filter((view) => view.isPinned);
    if (pinned.length === 0) {
      return 0;
    }
    return Math.max(...pinned.map((view) => view.pinOrder)) + 1;
  }, [savedViewList]);

  const handleApplySavedView = useCallback(
    (id: string) => {
      const view = applySavedView(id);
      if (view) {
        setActiveViewId(id);
        hasUserInteractedRef.current = true;
      }
    },
    [applySavedView],
  );

  const toggleSortMode = handleToggleSortMode;

  const toggleSelectionMode = handleToggleSelectionMode;

  const handleExportSelected = useCallback(async () => {
    const result = await exportSelectedCardsAsJson(selectedCards);
    setPaletteMessage({
      tone: result.ok ? "success" : "error",
      text: result.message,
    });
  }, [selectedCards]);

  const tagEditDisabledReason = canEditTags
    ? undefined
    : "태그를 수정하려면 편집 권한이 필요합니다.";

  const refreshTags = useCallback(async () => {
    setIsUpdatingTags(true);
    try {
      const response = await fetch(
        apiV1Path(`boards/${boardId}/tags?withCounts=1`),
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        tags?: BoardTag[];
        message?: string;
      };
      if (response.ok && data.ok && data.tags) {
        setAvailableTags(data.tags);
      } else if (!response.ok || !data.ok) {
        setPaletteMessage({
          tone: "error",
          text: data.message ?? "태그를 불러오지 못했습니다.",
        });
      }
    } catch (error) {
      console.error("Failed to refresh tags", error);
    } finally {
      setIsUpdatingTags(false);
    }
  }, [boardId]);

  const handleCreateTag = useCallback(
    async (input: { name: string; color?: string | null }) => {
      if (!canEditTags) {
        return {
          ok: false as const,
          error: tagEditDisabledReason ?? "권한이 없습니다.",
        };
      }
      setIsUpdatingTags(true);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/tags`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = (await response.json()) as {
          ok: boolean;
          tag?: BoardTag;
          message?: string;
        };
        if (!response.ok || !data.ok || !data.tag) {
          return {
            ok: false as const,
            error: data.message ?? "태그를 생성하지 못했습니다.",
          };
        }
        setAvailableTags((prev) =>
          [...prev, data.tag as BoardTag].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        setPaletteMessage({ tone: "success", text: "태그를 추가했어요." });
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "태그를 생성하지 못했습니다." };
      } finally {
        setIsUpdatingTags(false);
      }
    },
    [boardId, canEditTags, tagEditDisabledReason],
  );

  const handleTogglePinnedView = useCallback(
    (viewId: string, nextPinned?: boolean) => {
      const target = savedViewList.find((view) => view.id === viewId);
      if (!target) {
        return Promise.resolve({
          ok: false as const,
          error: "뷰를 찾을 수 없어요.",
        });
      }
      const willPin =
        typeof nextPinned === "boolean" ? nextPinned : !target.isPinned;
      const pinOrder = willPin ? target.pinOrder || nextPinnedOrder() : 0;
      hasUserInteractedRef.current = true;
      return updateSavedView(viewId, { isPinned: willPin, pinOrder });
    },
    [nextPinnedOrder, savedViewList, updateSavedView],
  );

  const handleUpdateView = useCallback(
    (
      viewId: string,
      patch: Partial<Pick<SavedView, "name" | "isPinned" | "isDefault">>,
    ) => {
      const target = savedViewList.find((view) => view.id === viewId);
      const nextPinOrder =
        patch.isPinned !== undefined
          ? patch.isPinned
            ? target?.pinOrder || nextPinnedOrder()
            : 0
          : target?.pinOrder;
      return updateSavedView(viewId, { ...patch, pinOrder: nextPinOrder });
    },
    [nextPinnedOrder, savedViewList, updateSavedView],
  );

  const handleSetDefaultView = useCallback(
    async (viewId: string) => {
      const result = await updateSavedView(viewId, { isDefault: true });
      if (result.ok) {
        hasUserInteractedRef.current = true;
      }
      return result;
    },
    [updateSavedView],
  );

  const handleDeleteView = useCallback(
    async (viewId: string) => {
      const result = await deleteSavedView(viewId);
      if (result.ok && activeViewId === viewId) {
        setActiveViewId(null);
      }
      return result;
    },
    [activeViewId, deleteSavedView],
  );

  const handleRenameView = useCallback(
    (viewId: string) => {
      const target = savedViewList.find((view) => view.id === viewId);
      if (!target) {
        return;
      }
      const nextName = window.prompt("뷰 이름을 입력해 주세요.", target.name);
      if (nextName === null) {
        return;
      }
      void updateSavedView(viewId, { name: nextName });
    },
    [savedViewList, updateSavedView],
  );

  useEffect(() => {
    if (appliedDefaultViewRef.current) {
      return;
    }
    if (!savedViewsReady) {
      return;
    }
    if (activeViewParam) {
      return;
    }
    if (hasUserInteractedRef.current) {
      return;
    }
    if (!defaultSavedViewId) {
      return;
    }
    const applied = applySavedView(defaultSavedViewId);
    if (applied) {
      setActiveViewId(defaultSavedViewId);
      appliedDefaultViewRef.current = true;
      hasUserInteractedRef.current = true;
    }
  }, [activeViewParam, applySavedView, defaultSavedViewId, savedViewsReady]);

  const pinnedSavedViews = useMemo(
    () =>
      savedViewList
        .filter((view) => view.isPinned)
        .sort((a, b) =>
          a.pinOrder !== b.pinOrder
            ? a.pinOrder - b.pinOrder
            : a.name.localeCompare(b.name),
        ),
    [savedViewList],
  );

  const activeSavedView = useMemo(
    () => savedViewList.find((view) => view.id === activeViewId) ?? null,
    [activeViewId, savedViewList],
  );

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      if (!canEditTags) {
        return {
          ok: false as const,
          error: tagEditDisabledReason ?? "권한이 없습니다.",
        };
      }
      setIsUpdatingTags(true);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/tags`), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          message?: string;
        };
        if (!response.ok || !data.ok) {
          return {
            ok: false as const,
            error: data.message ?? "태그를 삭제하지 못했습니다.",
          };
        }
        setAvailableTags((prev) => prev.filter((tag) => tag.id !== tagId));
        setTagsFilter((prev) => prev.filter((id) => id !== tagId));
        setPaletteMessage({ tone: "success", text: "태그를 삭제했어요." });
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "태그를 삭제하지 못했습니다." };
      } finally {
        setIsUpdatingTags(false);
      }
    },
    [boardId, canEditTags, tagEditDisabledReason],
  );

  const handleApplyTagsBulk = useCallback(
    async (input: { addTagIds: string[]; removeTagIds: string[] }) => {
      if (!canEditTags) {
        return {
          ok: false as const,
          error: tagEditDisabledReason ?? "권한이 없습니다.",
        };
      }
      if (selection.selectedCount === 0) {
        return { ok: false as const, error: "선택된 카드가 없습니다." };
      }
      setIsUpdatingTags(true);
      try {
        const response = await fetch(
          apiV1Path(`boards/${boardId}/cards/tags/bulk`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cardIds: selection.selectedIdList,
              addTagIds: input.addTagIds,
              removeTagIds: input.removeTagIds,
            }),
          },
        );
        const data = (await response.json()) as {
          ok: boolean;
          message?: string;
        };
        if (!response.ok || !data.ok) {
          return {
            ok: false as const,
            error: data.message ?? "태그를 업데이트하지 못했습니다.",
          };
        }
        await refreshTags();
        router.refresh();
        setPaletteMessage({ tone: "success", text: "태그를 업데이트했어요." });
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "태그를 업데이트하지 못했습니다." };
      } finally {
        setIsUpdatingTags(false);
      }
    },
    [
      boardId,
      canEditTags,
      refreshTags,
      router,
      selection.selectedCount,
      selection.selectedIdList,
      tagEditDisabledReason,
    ],
  );

  const handleMoveSelectedToWall = useCallback(
    async (targetWallId: string) => {
      if (!isSelectionMode) {
        setPaletteMessage({
          tone: "error",
          text: "선택 모드에서만 이동할 수 있어요.",
        });
        return;
      }
      const result = await runBulkCardAction({
        boardId,
        cardIds: selection.selectedIdList,
        action: "move",
        payload: { wallId: targetWallId },
      });
      if (!result.ok) {
        setPaletteMessage({ tone: "error", text: result.message });
        return;
      }
      setPaletteMessage({
        tone: "success",
        text: buildBulkActionSuccessMessage("move", result.updated),
      });
      selection.clearSelection();
      router.refresh();
    },
    [boardId, isSelectionMode, router, selection],
  );

  const handleDeleteSelected = useCallback(async () => {
    const result = await runBulkCardAction({
      boardId,
      cardIds: selection.selectedIdList,
      action: "delete",
    });
    if (!result.ok) {
      setPaletteMessage({ tone: "error", text: result.message });
      return;
    }
    setPaletteMessage({
      tone: "success",
      text: buildBulkActionSuccessMessage("delete", result.updated),
    });
    selection.clearSelection();
    router.refresh();
  }, [boardId, router, selection]);

  const scrollToNewCard = useCallback(() => {
    const target = document.getElementById("card-form");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const selectedVisibleCount = useMemo(
    () => reorderVisibleCardIds.filter((id) => selection.isSelected(id)).length,
    [reorderVisibleCardIds, selection],
  );
  const isAllSelected =
    reorderVisibleCardIds.length > 0 &&
    selectedVisibleCount === reorderVisibleCardIds.length;

  const handleToggleAllSelection = useCallback(() => {
    if (!isSelectionMode) {
      return;
    }
    if (isAllSelected) {
      startTransition(() => {
        selection.clearSelection();
      });
    } else {
      startTransition(() => {
        selection.setSelectionIds(reorderVisibleCardIds);
      });
    }
  }, [isAllSelected, isSelectionMode, reorderVisibleCardIds, selection]);

  const visibleCountLabel = isFiltered
    ? `표시 ${filteredCardsCount}개 / 전체 ${orderedCards.length}개`
    : `표시 ${orderedCards.length}개`;
  const canExportSelection = selection.selectedCount > 0;
  const recentHistoryItems = useMemo(() => {
    const combined = [...past, present];
    const startIndex = Math.max(0, combined.length - 5);
    return combined.slice(startIndex).map((entry, index) => {
      const absoluteIndex = startIndex + index;
      return {
        id: String(absoluteIndex),
        label: entry.label,
        isActive: absoluteIndex === combined.length - 1,
        pastIndex: absoluteIndex < past.length ? absoluteIndex : null,
      };
    });
  }, [past, present]);

  const recentHistoryIndexMap = useMemo(
    () => new Map(recentHistoryItems.map((item) => [item.id, item.pastIndex])),
    [recentHistoryItems],
  );

  const handleJumpToRecent = useCallback(
    (entryId: string) => {
      const pastIndex = recentHistoryIndexMap.get(entryId);
      if (pastIndex === undefined || pastIndex === null) {
        return;
      }
      const entry = jumpToPast(pastIndex);
      if (entry) {
        applyHistoryState(entry.state);
      }
    },
    [applyHistoryState, jumpToPast, recentHistoryIndexMap],
  );

  const sectionPaletteItems = useMemo(
    () => [
      {
        id: "featured",
        label: "대표 카드",
        count: visibleFeaturedCards.length,
      },
      { id: "pinned", label: "핀 고정", count: visiblePinnedCards.length },
      { id: "normal", label: "일반 카드", count: visibleNormalCards.length },
    ],
    [
      visibleFeaturedCards.length,
      visiblePinnedCards.length,
      visibleNormalCards.length,
    ],
  );
  const cardTitleCacheRef = useRef(new Map<string, string>());
  const cardJumpBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cardJumpBuiltOnceRef = useRef(false);
  const cardJumpDirtyRef = useRef(true);
  const [cardJumpPaletteItems, setCardJumpPaletteItems] = useState<
    Array<{ id: string; title: string }>
  >([]);

  useEffect(() => {
    cardJumpDirtyRef.current = true;
  }, [orderedCards]);

  const paletteItems = useMemo(
    () => [
      {
        id: "class-mode-collect",
        label: "모드 전환: 수집",
        description: "Inbox 중심, 입력 우선 모드로 전환합니다.",
        keywords: ["mode", "collect", "수집"],
        enabled: true,
        run: () => handleClassModeChange("collect"),
      },
      {
        id: "class-mode-organize",
        label: "모드 전환: 정리",
        description: "태그/대량 작업에 최적화된 보기로 전환합니다.",
        keywords: ["mode", "organize", "정리", "bulk"],
        enabled: true,
        run: () => handleClassModeChange("organize"),
      },
      {
        id: "class-mode-present",
        label: "모드 전환: 발표",
        description: "프로젝터 친화 모드(큰 글씨/전체화면/F 키)로 전환합니다.",
        keywords: ["mode", "present", "발표", "fullscreen"],
        enabled: true,
        run: () => handleClassModeChange("present"),
      },
      {
        id: "present-fullscreen",
        label: isFullscreen ? "발표: 전체화면 종료" : "발표: 전체화면 실행",
        description:
          classMode === "present"
            ? "F 키로도 토글할 수 있어요."
            : "발표 모드에서 사용할 수 있어요.",
        keywords: ["present", "fullscreen", "발표", "전체화면"],
        enabled: classMode === "present",
        run: () => void handleToggleFullscreen(),
      },
      {
        id: "search-focus",
        label: "카드 검색 포커스",
        description: "검색 입력창으로 이동합니다.",
        keywords: ["search", "검색", "find"],
        enabled: true,
        run: focusSearchInput,
      },
      {
        id: "search-clear",
        label: "검색어 지우기",
        description: normalizedImmediateSearchTerm
          ? "현재 검색어를 초기화합니다."
          : "검색어가 없습니다.",
        keywords: ["clear", "검색어", "reset", "초기화"],
        enabled: Boolean(normalizedImmediateSearchTerm),
        run: clearSearch,
      },
      {
        id: "tag-filter-open",
        label: "태그 필터 열기",
        description: "태그 필터를 열고 태그를 선택합니다.",
        keywords: ["tag", "태그", "filter", "필터"],
        enabled: true,
        run: () => setIsTagPopoverOpen(true),
      },
      {
        id: "tag-filter-clear",
        label: "태그 필터 초기화",
        description:
          tagsFilter.length > 0
            ? "모든 태그 필터를 해제합니다."
            : "적용된 태그가 없습니다.",
        keywords: ["tag", "태그", "clear", "reset"],
        enabled: tagsFilter.length > 0,
        run: clearTagFilter,
      },
      {
        id: "activity-toggle",
        label: isActivityPanelOpen ? "최근 활동 닫기" : "최근 활동 열기",
        description: "최근 감사 로그 패널을 전환합니다.",
        keywords: ["activity", "audit", "최근", "활동"],
        enabled: true,
        run: toggleActivityPanel,
      },
      ...(["all", "card", "collab", "trash", "mine"] as ActivityFilter[]).map(
        (filterKey) => ({
          id: `activity-filter-${filterKey}`,
          label: `활동 필터: ${FILTER_LABELS[filterKey]}`,
          description: "최근 활동 패널 필터를 변경합니다.",
          keywords: ["activity", "필터", "audit", filterKey],
          enabled: true,
          run: () => openActivityPanelWithFilter(filterKey),
        }),
      ),
      {
        id: "trash-open",
        label: "휴지통 열기",
        description: canOpenTrash
          ? "휴지통 페이지로 이동합니다."
          : (trashAccessMessage ?? "권한이 없습니다."),
        keywords: ["trash", "휴지통", "삭제"],
        enabled: canOpenTrash,
        run: () => router.push(trashHref),
      },
      {
        id: "view-save",
        label: "뷰: 현재 보기 저장...",
        description: "현재 검색/필터 상태를 저장합니다.",
        keywords: ["view", "뷰", "save", "저장", "preset"],
        enabled: true,
        run: () => setIsViewPopoverOpen(true),
      },
      ...pinnedSavedViews.map((view, index) => ({
        id: `pinned-view-apply-${view.id}`,
        label: `고정 뷰${index < 5 ? ` ${index + 1}` : ""}: ${view.name} 적용`,
        description: "상단에 고정된 뷰를 즉시 적용합니다.",
        keywords: ["pinned", "pin", "고정", "뷰", view.name],
        enabled: true,
        run: () => handleApplySavedView(view.id),
      })),
      {
        id: "pinned-view-toggle",
        label: activeSavedView?.isPinned
          ? "현재 뷰 핀 해제"
          : "현재 뷰 핀으로 고정",
        description: activeSavedView
          ? "현재 적용된 뷰의 핀 상태를 전환합니다."
          : "적용된 뷰가 없어요.",
        keywords: ["pinned", "pin", "고정", "뷰"],
        enabled: Boolean(activeSavedView),
        run: () => {
          if (!activeSavedView) {
            return;
          }
          void handleTogglePinnedView(
            activeSavedView.id,
            !activeSavedView.isPinned,
          );
        },
      },
      {
        id: "default-view-set",
        label: "현재 뷰를 기본으로 설정",
        description: activeSavedView
          ? "현재 적용된 뷰를 기본 뷰로 지정합니다."
          : "적용된 뷰가 없어요.",
        keywords: ["default", "기본", "뷰"],
        enabled: Boolean(activeSavedView),
        run: () => {
          if (!activeSavedView) {
            return;
          }
          void handleSetDefaultView(activeSavedView.id);
        },
      },
      {
        id: "ui-prefs-open",
        label: "설정: 보기 옵션 열기",
        description: "카드 목록 보기 설정을 엽니다.",
        keywords: ["설정", "preferences", "density", "hint", "line"],
        enabled: true,
        run: () => setIsUiPrefsOpen(true),
      },
      {
        id: "safe-mode-toggle",
        label: isSafeMode ? "Safe Mode 끄기" : "Safe Mode 켜기",
        description: "TV 노출용 간결 레이아웃을 전환합니다.",
        keywords: ["safe", "tv", "mini", "클린"],
        enabled: true,
        run: handleToggleSafeMode,
      },
      {
        id: "ui-prefs-density",
        label: `설정: 밀도 ${uiPrefs.density === "compact" ? "Comfortable" : "Compact"}`,
        description: "카드 목록 밀도를 전환합니다.",
        keywords: ["density", "밀도", "compact", "comfortable"],
        enabled: true,
        run: () =>
          updatePrefs({
            density: uiPrefs.density === "compact" ? "comfortable" : "compact",
          }),
      },
      {
        id: "ui-prefs-hints",
        label: `설정: 힌트 ${uiPrefs.showKeyboardHints ? "끄기" : "켜기"}`,
        description: "키보드 힌트 줄 표시를 전환합니다.",
        keywords: ["hint", "힌트", "keyboard"],
        enabled: true,
        run: () =>
          updatePrefs({ showKeyboardHints: !uiPrefs.showKeyboardHints }),
      },
      ...([2, 3, 4] as const).map((lines) => ({
        id: `ui-prefs-lines-${lines}`,
        label: `설정: 본문 ${lines}줄`,
        description: "카드 본문 줄 수를 바꿉니다.",
        keywords: ["line", "줄", "clamp"],
        enabled: uiPrefs.textClampLines !== lines,
        run: () => updatePrefs({ textClampLines: lines }),
      })),
      ...savedViewList
        .filter((view) => !view.isPinned)
        .map((view) => ({
          id: `view-apply-${view.id}`,
          label: `뷰: ${view.name} 적용`,
          description: "저장된 보기 상태로 전환합니다.",
          keywords: ["view", "뷰", "apply", "preset", view.name],
          enabled: true,
          run: () => handleApplySavedView(view.id),
        })),
      {
        id: "view-manage",
        label: "뷰: 관리 열기",
        description: "저장된 뷰를 관리합니다.",
        keywords: ["view", "뷰", "manage", "관리"],
        enabled: true,
        run: () => setIsViewPopoverOpen(true),
      },
      {
        id: "sort-toggle",
        label: isSortMode ? "정렬 모드 종료" : "정렬 모드 시작",
        description: isSortMode
          ? "정렬 모드를 종료하고 일반 보기로 전환합니다."
          : "드래그로 순서를 바꿀 수 있게 합니다.",
        keywords: ["sort", "정렬", "reorder"],
        enabled: true,
        run: toggleSortMode,
      },
      {
        id: "selection-toggle",
        label: isSelectionMode ? "선택 모드 종료" : "선택 모드 시작",
        description: isSelectionMode
          ? "선택 모드를 종료합니다."
          : "카드를 여러 개 선택할 수 있게 합니다.",
        keywords: ["select", "선택", "multi"],
        enabled: true,
        run: toggleSelectionMode,
      },
      {
        id: "selection-toggle-all",
        label: isAllSelected ? "전체 선택 해제" : "전체 선택",
        description: isSelectionMode
          ? isAllSelected
            ? "선택된 카드를 모두 해제합니다."
            : "현재 표시된 카드를 모두 선택합니다."
          : "선택 모드에서만 사용할 수 있어요.",
        keywords: ["select all", "전체", "toggle"],
        enabled: isSelectionMode && reorderVisibleCardIds.length > 0,
        run: handleToggleAllSelection,
      },
      {
        id: "selection-export",
        label: "선택 항목 내보내기(JSON)",
        description: canExportSelection
          ? "선택한 카드 내용을 JSON으로 복사합니다."
          : "선택된 카드가 없습니다.",
        keywords: ["export", "json", "내보내기", "복사"],
        enabled: canExportSelection,
        run: handleExportSelected,
      },
      {
        id: "selection-move-current-wall",
        label: "선택 카드 현재 섹션으로 이동",
        description:
          isSelectionMode && selection.selectedCount > 0
            ? "선택한 카드를 현재 카드의 섹션으로 이동합니다."
            : "선택 모드에서 카드를 선택한 뒤 사용할 수 있어요.",
        keywords: ["move", "bulk", "섹션", "이동", "선택"],
        enabled:
          isSelectionMode &&
          selection.selectedCount > 0 &&
          Boolean(activeCardId),
        run: () => {
          if (!activeCardId) return;
          const activeCard = orderedCards.find(
            (card) => card.id === activeCardId,
          );
          if (!activeCard) return;
          void handleMoveSelectedToWall(activeCard.wall_id);
        },
      },
      {
        id: "selection-delete",
        label: "선택 카드 삭제",
        description: canSoftDelete
          ? "선택한 카드를 휴지통으로 이동합니다."
          : (softDeleteMessage ?? "삭제 권한이 없습니다."),
        keywords: ["delete", "trash", "삭제", "선택", "bulk"],
        enabled:
          isSelectionMode && selection.selectedCount > 0 && canSoftDelete,
        run: () => {
          void handleDeleteSelected();
        },
      },
      {
        id: "jump-section-root",
        label: "섹션으로 이동…",
        description: "섹션 목록 검색은 아래 항목에서 바로 선택하세요.",
        keywords: ["jump", "section", "섹션", "이동"],
        enabled: false,
        run: () => {},
      },
      ...sectionPaletteItems
        .filter((section) => section.count > 0)
        .map((section) => ({
          id: `jump-section-${section.id}`,
          label: `섹션으로 이동… ${section.label}`,
          description: `${section.count}개 카드가 있는 섹션으로 스크롤합니다.`,
          keywords: ["jump", "section", "섹션", "이동", section.label],
          enabled: true,
          run: () => {
            scrollToSection(section.id, {
              behavior: "smooth",
              align: "start",
              offsetTop: 12,
            });
          },
        })),
      {
        id: "jump-card-root",
        label: "카드로 이동…",
        description: "카드 제목 검색은 아래 항목에서 바로 선택하세요.",
        keywords: ["jump", "card", "카드", "이동", "제목"],
        enabled: false,
        run: () => {},
      },
      ...cardJumpPaletteItems.map((item) => ({
        id: `jump-card-${item.id}`,
        label: `카드로 이동… ${item.title}`,
        description: "선택한 카드로 스크롤하고 강조합니다.",
        keywords: ["jump", "card", "카드", "이동", item.title],
        enabled: true,
        run: () => {
          const resolved = resolveCardAnchor(item.id);
          if (!resolved) {
            return;
          }
          const result = scrollToCard(resolved, {
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
          if (result.ok) {
            setHighlightedCardId(resolved);
          }
        },
      })),

      {
        id: "new-card",
        label: "새 카드로 이동",
        description: "카드 작성 영역으로 스크롤합니다.",
        keywords: ["new", "카드", "작성", "add"],
        enabled: true,
        run: scrollToNewCard,
      },
      {
        id: "history-undo",
        label: "되돌리기",
        description: canUndo
          ? "최근 작업을 되돌립니다."
          : "되돌릴 기록이 없습니다.",
        keywords: ["undo", "되돌리기", "취소"],
        enabled: canUndo,
        run: handleUndo,
      },
      {
        id: "history-redo",
        label: "다시 실행",
        description: canRedo
          ? "되돌린 작업을 다시 실행합니다."
          : "다시 실행할 기록이 없습니다.",
        keywords: ["redo", "다시", "재실행"],
        enabled: canRedo,
        run: handleRedo,
      },
    ],
    [
      canRedo,
      canUndo,
      canExportSelection,
      classMode,
      selection.selectedCount,
      clearSearch,
      activeCardId,
      focusSearchInput,
      handleExportSelected,
      handleMoveSelectedToWall,
      handleDeleteSelected,
      handleClassModeChange,
      handleToggleFullscreen,
      handleToggleAllSelection,
      handleUndo,
      handleRedo,
      isActivityPanelOpen,
      isFullscreen,
      isAllSelected,
      isSelectionMode,
      isSortMode,
      normalizedImmediateSearchTerm,
      openActivityPanelWithFilter,
      scrollToNewCard,
      sectionPaletteItems,
      cardJumpPaletteItems,
      toggleActivityPanel,
      handleApplySavedView,
      handleSetDefaultView,
      handleTogglePinnedView,
      canOpenTrash,
      trashAccessMessage,
      orderedCards,
      canSoftDelete,
      softDeleteMessage,
      activeSavedView,
      pinnedSavedViews,
      savedViewList,
      router,
      setIsViewPopoverOpen,
      setIsUiPrefsOpen,
      setIsTagPopoverOpen,
      toggleSelectionMode,
      toggleSortMode,
      reorderVisibleCardIds.length,
      trashHref,
      isSafeMode,
      handleToggleSafeMode,
      uiPrefs.density,
      uiPrefs.showKeyboardHints,
      uiPrefs.textClampLines,
      updatePrefs,
      clearTagFilter,
      tagsFilter.length,
    ],
  );

  const palette = useCommandPalette(paletteItems);

  useEffect(() => {
    const shouldBuild = shouldBuildCardJumpList({
      isPaletteOpen: palette.isOpen,
      hasBuilt: cardJumpBuiltOnceRef.current,
      isDirty: cardJumpDirtyRef.current,
    });
    if (!shouldBuild) {
      return;
    }

    if (cardJumpBuildTimerRef.current) {
      clearTimeout(cardJumpBuildTimerRef.current);
    }

    cardJumpBuildTimerRef.current = setTimeout(() => {
      setCardJumpPaletteItems(
        buildCardJumpPaletteItems(orderedCards, cardTitleCacheRef.current),
      );
      cardJumpDirtyRef.current = false;
      cardJumpBuiltOnceRef.current = true;
      cardJumpBuildTimerRef.current = null;
    }, CARD_JUMP_BUILD_DEBOUNCE_MS);

    return () => {
      if (!cardJumpBuildTimerRef.current) return;
      clearTimeout(cardJumpBuildTimerRef.current);
      cardJumpBuildTimerRef.current = null;
    };
  }, [orderedCards, palette.isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (palette.isOpen || hasOpenDialog()) {
        return;
      }
      if (!event.altKey || event.key.toLowerCase() !== "a") {
        return;
      }
      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return;
      }
      event.preventDefault();
      toggleActivityPanel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasOpenDialog, isEditableTarget, palette.isOpen, toggleActivityPanel]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        !keymapMatchesEvent(event, keymap.togglePalette, { allowShift: true })
      ) {
        return;
      }
      if (!palette.isOpen) {
        if (hasOpenDialog()) {
          return;
        }
        if (
          isEditableTarget(event.target) ||
          isEditableTarget(document.activeElement)
        ) {
          return;
        }
      }
      event.preventDefault();
      palette.toggle();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasOpenDialog, isEditableTarget, keymap.togglePalette, palette]);

  useEffect(() => {
    if (!isSelectionMode) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (palette.isOpen) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleToggleSelectionMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSelectionMode, isSelectionMode, palette.isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const isUndo = keymapMatchesEvent(event, keymap.undo);
      const isRedo = keymapMatchesEvent(event, keymap.redo);

      if (!isUndo && !isRedo) {
        return;
      }
      if (palette.isOpen || hasOpenDialog()) {
        return;
      }
      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return;
      }

      event.preventDefault();
      if (isUndo) {
        handleUndo();
      } else {
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleRedo,
    handleUndo,
    hasOpenDialog,
    isEditableTarget,
    keymap.redo,
    keymap.undo,
    palette.isOpen,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (palette.isOpen || hasOpenDialog()) {
        return;
      }
      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return;
      }

      if (
        keymapMatchesEvent(event, keymap.toggleSafeMode, { allowShift: true })
      ) {
        event.preventDefault();
        handleToggleSafeMode();
        return;
      }
      if (
        keymapMatchesEvent(event, keymap.classModeCollect, { allowShift: true })
      ) {
        event.preventDefault();
        handleClassModeChange("collect");
        return;
      }
      if (
        keymapMatchesEvent(event, keymap.classModeOrganize, {
          allowShift: true,
        })
      ) {
        event.preventDefault();
        handleClassModeChange("organize");
        return;
      }
      if (
        keymapMatchesEvent(event, keymap.classModePresent, { allowShift: true })
      ) {
        event.preventDefault();
        handleClassModeChange("present");
        return;
      }
      if (
        classMode === "present" &&
        keymapMatchesEvent(event, keymap.toggleFullscreen, { allowShift: true })
      ) {
        event.preventDefault();
        void handleToggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    classMode,
    handleClassModeChange,
    handleToggleFullscreen,
    handleToggleSafeMode,
    hasOpenDialog,
    isEditableTarget,
    keymap.toggleSafeMode,
    keymap.classModeCollect,
    keymap.classModeOrganize,
    keymap.classModePresent,
    keymap.toggleFullscreen,
    palette.isOpen,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (palette.isOpen || hasOpenDialog()) {
        return;
      }
      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return;
      }

      const pinCommands = [
        { specs: keymap.applyPinned1, view: pinnedSavedViews[0] },
        { specs: keymap.applyPinned2, view: pinnedSavedViews[1] },
        { specs: keymap.applyPinned3, view: pinnedSavedViews[2] },
        { specs: keymap.applyPinned4, view: pinnedSavedViews[3] },
        { specs: keymap.applyPinned5, view: pinnedSavedViews[4] },
      ];

      for (const entry of pinCommands) {
        if (entry.view && keymapMatchesEvent(event, entry.specs)) {
          event.preventDefault();
          handleApplySavedView(entry.view.id);
          return;
        }
      }

      if (
        keymapMatchesEvent(event, keymap.togglePinnedView) &&
        activeSavedView
      ) {
        event.preventDefault();
        void handleTogglePinnedView(
          activeSavedView.id,
          !activeSavedView.isPinned,
        );
        return;
      }

      if (keymapMatchesEvent(event, keymap.setDefaultView) && activeSavedView) {
        event.preventDefault();
        void handleSetDefaultView(activeSavedView.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeSavedView,
    handleApplySavedView,
    handleSetDefaultView,
    handleTogglePinnedView,
    hasOpenDialog,
    isEditableTarget,
    keymap.applyPinned1,
    keymap.applyPinned2,
    keymap.applyPinned3,
    keymap.applyPinned4,
    keymap.applyPinned5,
    keymap.setDefaultView,
    keymap.togglePinnedView,
    palette.isOpen,
    pinnedSavedViews,
  ]);

  useEffect(() => {
    if (classMode !== "present") {
      return;
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (palette.isOpen || hasOpenDialog()) {
        return;
      }
      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n" || event.key === "ArrowRight") {
        event.preventDefault();
        focusNextCard();
        return;
      }
      if (key === "p" || event.key === "ArrowLeft") {
        event.preventDefault();
        focusPrevCard();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        void handleToggleFullscreen();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        exitPresentMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    classMode,
    exitPresentMode,
    focusNextCard,
    focusPrevCard,
    handleToggleFullscreen,
    hasOpenDialog,
    isEditableTarget,
    palette.isOpen,
  ]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (palette.isOpen) {
        return;
      }
      if (!section.contains(event.target as Node)) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const totalCards = reorderVisibleCardIds.length;
      if (totalCards === 0) {
        return;
      }

      const moveFocus = (delta: number, withRange?: boolean) => {
        shouldRecordFocusRef.current = true;
        setActiveIndex((prev) => {
          const nextIndex = Math.max(0, Math.min(totalCards - 1, prev + delta));
          const nextId = reorderVisibleCardIds[nextIndex];
          if (withRange && isSelectionMode && nextId) {
            if (activeCardId && !selection.isSelected(activeCardId)) {
              startTransition(() => {
                selection.toggleSelection(activeCardId);
              });
            }
            startTransition(() => {
              selection.toggleSelection(nextId, {
                range: true,
                rangeIds: reorderVisibleCardIds,
              });
            });
          }
          return nextIndex;
        });
      };

      if (keymapMatchesEvent(event, keymap.navDown, { allowShift: true })) {
        event.preventDefault();
        moveFocus(1, event.shiftKey);
        return;
      }

      if (keymapMatchesEvent(event, keymap.navUp, { allowShift: true })) {
        event.preventDefault();
        moveFocus(-1, event.shiftKey);
        return;
      }

      if (keymapMatchesEvent(event, keymap.focusSearch)) {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (keymapMatchesEvent(event, keymap.openActive, { allowShift: true })) {
        if (isSelectionMode || isSortMode) {
          return;
        }
        if (activeCardId) {
          event.preventDefault();
          router.push(buildCardHref(activeCardId));
        }
      }

      if (
        keymapMatchesEvent(event, keymap.toggleSelectActive, {
          allowShift: true,
        })
      ) {
        if (!isSelectionMode || isSortMode) {
          return;
        }
        if (activeCardId) {
          event.preventDefault();
          startTransition(() => {
            selection.toggleSelection(activeCardId, {
              range: event.shiftKey,
              rangeIds: reorderVisibleCardIds,
            });
          });
        }
      }

      if (keymapMatchesEvent(event, keymap.toggleSort, { allowShift: true })) {
        event.preventDefault();
        handleToggleSortMode();
        return;
      }

      if (
        keymapMatchesEvent(event, keymap.toggleSelection, { allowShift: true })
      ) {
        event.preventDefault();
        handleToggleSelectionMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardId,
    buildCardHref,
    focusSearchInput,
    isSelectionMode,
    isSortMode,
    isEditableTarget,
    handleToggleSelectionMode,
    handleToggleSortMode,
    keymap.focusSearch,
    keymap.navDown,
    keymap.navUp,
    keymap.openActive,
    keymap.toggleSelectActive,
    keymap.toggleSelection,
    keymap.toggleSort,
    palette.isOpen,
    router,
    selection,
    reorderVisibleCardIds,
  ]);

  const handleRegisterCardRef = useCallback(
    (
      cardId: string,
      node: HTMLLIElement | null,
      registerItem?: (id: string) => (node: HTMLLIElement | null) => void,
    ) => {
      if (registerItem) {
        registerItem(cardId)(node);
      }
      if (node) {
        cardRefs.current.set(cardId, node);
      } else {
        cardRefs.current.delete(cardId);
      }
    },
    [],
  );

  const handleActivateCard = useCallback(
    (cardId: string) => {
      setActiveIndexWithHistory(reorderIndexById.get(cardId) ?? 0);
    },
    [reorderIndexById, setActiveIndexWithHistory],
  );

  const handleToggleCardSelection = useCallback(
    (cardId: string, options?: { range?: boolean; additive?: boolean }) => {
      if (!isSelectionMode) {
        return;
      }
      startTransition(() => {
        selection.toggleSelection(cardId, {
          range: options?.range,
          rangeIds: reorderVisibleCardIds,
          additive: options?.additive,
        });
      });
    },
    [isSelectionMode, reorderVisibleCardIds, selection],
  );

  return (
    <div className="space-y-4" ref={sectionRef}>
      <CommandPalette
        isOpen={palette.isOpen}
        query={palette.query}
        items={palette.filteredItems}
        activeIndex={palette.activeIndex}
        onQueryChange={palette.setQuery}
        onClose={palette.close}
        onSelect={palette.runItem}
        onActiveChange={palette.setActiveIndex}
        toggleHint={formatKeySpecList(keymap.togglePalette)}
      />
      {savedViewsNotice ? (
        <InlineAlert
          tone="info"
          title={savedViewsNotice.title}
          description={savedViewsNotice.description}
          className="py-2 text-xs"
          action={
            savedViewsNotice.actionLabel ? (
              <button
                type="button"
                onClick={retrySavedViews}
                className="rounded-full border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300"
              >
                {savedViewsNotice.actionLabel}
              </button>
            ) : null
          }
        />
      ) : null}
      {uiPrefsNotice ? (
        <InlineAlert
          tone="info"
          title={uiPrefsNotice.title}
          description={uiPrefsNotice.description}
          className="py-2 text-xs"
          action={
            uiPrefsNotice.actionLabel ? (
              <button
                type="button"
                onClick={retryUiPrefs}
                className="rounded-full border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300"
              >
                {uiPrefsNotice.actionLabel}
              </button>
            ) : null
          }
        />
      ) : null}
      {followError ? (
        <InlineAlert
          tone="warning"
          title="프로젝터 따라가기를 전송하지 못했습니다."
          description={followError}
          className="py-2 text-xs"
        />
      ) : null}
      <ActivityPanel
        boardId={boardId}
        isOpen={isActivityPanelOpen}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
        onClose={() => setIsActivityPanelOpen(false)}
        onJumpToCard={(cardId) => focusCardFromActivity(cardId)}
        trashHref={trashHref}
      />
      <TriagePanel
        boardId={boardId}
        variant={classMode === "present" ? "full" : "summary"}
      />
      <CardListHeader
        visibleCountLabel={visibleCountLabel}
        isSortMode={isSortMode}
        isSelectionMode={isSelectionMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleSort={handleToggleSortMode}
        onToggleSelection={handleToggleSelectionMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        recentHistoryItems={recentHistoryItems.map(
          ({ id, label, isActive }) => ({
            id,
            label,
            isActive,
          }),
        )}
        onJumpToRecent={handleJumpToRecent}
        classMode={classMode}
        onClassModeChange={handleClassModeChange}
        onNextCard={focusNextCard}
        onPrevCard={focusPrevCard}
        followEnabled={followEnabled}
        onToggleFollow={handleToggleFollow}
        onExitPresent={exitPresentMode}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onSearchKeyDown={handleSearchKeyDown}
        onSearchBlur={() => commitSearchHistory(searchTerm)}
        onClearSearch={clearSearch}
        searchInputRef={searchInputRef}
        showSearchDelayNotice={orderedCards.length > 300 && isSearchDeferred}
        showSelectedOnly={showSelectedOnly}
        onToggleShowSelectedOnly={handleToggleShowSelectedOnly}
        showInboxOnly={showInboxOnly}
        onToggleInboxOnly={handleToggleInboxOnly}
        viewState={{
          searchQuery: searchTerm,
          showSelectedOnly,
          tagsFilter,
          inboxOnly: showInboxOnly,
        }}
        activeViewId={activeViewId}
        savedViews={savedViewList}
        isViewPopoverOpen={isViewPopoverOpen}
        onViewPopoverChange={setIsViewPopoverOpen}
        onSaveView={(input) =>
          addSavedView({
            name: input.name,
            state: {
              searchQuery: searchTerm,
              showSelectedOnly,
              tagsFilter,
              inboxOnly: showInboxOnly,
            },
            isPinned: input.isPinned,
            isDefault: input.isDefault,
          })
        }
        onApplyView={handleApplySavedView}
        onUpdateView={handleUpdateView}
        onDeleteView={handleDeleteView}
        onTogglePin={handleTogglePinnedView}
        onSetDefault={handleSetDefaultView}
        onRenameView={handleRenameView}
        maxViews={maxSavedViews}
        uiPrefs={uiPrefs}
        isUiPrefsOpen={isUiPrefsOpen}
        onUiPrefsOpenChange={setIsUiPrefsOpen}
        onUpdateUiPrefs={updatePrefs}
        onToggleActivityPanel={toggleActivityPanel}
        isActivityPanelOpen={isActivityPanelOpen}
        tags={availableTags}
        selectedTags={tagsFilter}
        onToggleTagFilter={toggleTagFilter}
        onClearTagFilter={clearTagFilter}
        isTagPopoverOpen={isTagPopoverOpen}
        onTagPopoverChange={setIsTagPopoverOpen}
        canEditTags={canEditTags}
        onCreateTag={handleCreateTag}
        onDeleteTag={handleDeleteTag}
        isRefreshingTags={isUpdatingTags}
        onOpenTagRules={() => setIsTagRulesOpen(true)}
        isSafeMode={isSafeMode}
        onToggleSafeMode={handleToggleSafeMode}
      />
      <TagRulesPanel
        boardId={boardId}
        tags={availableTags}
        isOpen={isTagRulesOpen}
        onClose={() => setIsTagRulesOpen(false)}
        canEdit={canEditTags}
      />
      <CardListBody
        boardId={boardId}
        wallId={wallId}
        filesByCard={filesByCard}
        writeLocked={writeLocked}
        orderedCardsCount={orderedCards.length}
        isFiltered={isFiltered}
        hasFilteredResults={hasFilteredResults}
        visibleFeaturedCards={reorderFeaturedCards}
        visiblePinnedCards={reorderPinnedCards}
        visibleNormalCards={reorderNormalCards}
        visibleCardIds={reorderVisibleCardIds}
        visibleIndexById={reorderIndexById}
        isSortMode={isSortMode}
        isSelectionMode={isSelectionMode}
        isAllSelected={isAllSelected}
        selectedCount={selection.selectedCount}
        selectedIds={selection.selectedIdList}
        selectedCards={selectedCards}
        selectedCardId={selectedCardId}
        activeCardId={activeCardId}
        highlightedCardId={highlightedCardId}
        canSoftDelete={canSoftDelete}
        softDeleteMessage={softDeleteMessage}
        buildCardHref={buildCardHref}
        buildPageHref={buildPageHref}
        prevOffset={prevOffset}
        nextOffset={nextOffset}
        modeNotice={modeNotice}
        paletteMessage={paletteMessage}
        classMode={classMode}
        fullscreenNotice={fullscreenNotice}
        uiPrefs={uiPrefs}
        onDismissModeNotice={() => setModeNotice(null)}
        onDismissFullscreenNotice={() => setFullscreenNotice(null)}
        onClearSearch={clearSearch}
        onSelectAll={() =>
          startTransition(() =>
            selection.setSelectionIds(reorderVisibleCardIds),
          )
        }
        onClearSelection={() =>
          startTransition(() => selection.clearSelection())
        }
        onExitSelection={handleToggleSelectionMode}
        onActivateCard={handleActivateCard}
        onToggleSelection={handleToggleCardSelection}
        onMoveSelectedToWall={handleMoveSelectedToWall}
        onRegisterCardRef={handleRegisterCardRef}
        featuredReorder={featuredReorder}
        pinnedReorder={pinnedReorder}
        normalReorder={normalReorder}
        availableTags={availableTags}
        tagFilter={tagsFilter}
        onToggleTagFilter={toggleTagFilter}
        onClearTagFilter={clearTagFilter}
        onApplyBulkTags={handleApplyTagsBulk}
        canEditTags={canEditTags}
        isUpdatingTags={isUpdatingTags}
        tagEditDisabledReason={tagEditDisabledReason}
        onRefresh={() => router.refresh()}
      />
      <CardDetailOverlayWithQuery
        cardsIndex={cardsIndex}
        initialCardId={initialCardId}
        teacherActions={{ boardId, wallId, writeLocked }}
      />
    </div>
  );
}
