"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Board } from "@/lib/data/boards";
import type { CardColorToken } from "@/lib/types/cards";
import { CARD_COLOR_OPTIONS } from "@/lib/ui/cardColors";
import { useWallRealtime } from "@/lib/hooks/useWallRealtime";
import { useRealtimeClient } from "@/lib/realtime/client";
import type { RealtimeEvent } from "@/lib/realtime/events";
import { useBoardPrefs } from "@/lib/ui/useBoardPrefs";
import { buildJoinUrl, buildShareUrl, buildStudentUrl } from "@/lib/http/publicLinks";
import { boardClassHref, boardHubHref } from "@/lib/dashboard/boardHrefs";
import { CardDetailPanelWithQuery, type CardDetailPanelCard } from "@/app/_components/cards/CardDetailPanel";
import BoardSettingsDrawer from "@/app/_components/BoardSettingsDrawer";
import FileDropOverlay from "@/app/_components/FileDropOverlay";
import GridHotkeys from "@/app/_components/GridHotkeys";
import GridColumn from "@/app/_components/GridColumn";
import MoreMenu from "@/app/_components/MoreMenu";
import { dismissDashboardToast, pushDashboardToast, useDashboardToasts } from "@/app/dashboard/useDashboardToast";
import {
  popOneDeepUndo,
  pushOneDeepUndo,
  reduceGridSelection,
  type BulkUndoEntry,
} from "@/lib/board/gridBulkSelection";

const ComposeCardPanel = dynamic(() => import("@/app/_components/ComposeCardPanel"), { ssr: false });
const FileDrawer = dynamic(() => import("@/app/dashboard/_components/FileDrawer"), { ssr: false });

type GridCard = {
  id: string;
  wallId: string;
  text: string;
  authorName: string | null;
  createdAt: string;
  isHidden: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  cardColorToken: CardColorToken | null;
  hasAttachments?: boolean;
};

type GridColumnData = {
  wall: {
    id: string;
    title: string;
    description: string | null;
  };
  featuredCards: GridCard[];
  pinnedCards: GridCard[];
  cards: GridCard[];
  nextCursor: string | null;
  totalCount: number;
};

type TeacherGridBoardProps = {
  board: Board;
  boardId: string;
  columns: GridColumnData[];
  cardsIndex: React.ComponentProps<typeof CardDetailPanelWithQuery>["cardsIndex"];
  shareCode: string | null;
  shareEnabled: boolean;
  initialCardId?: string;
  settingsContent?: React.ReactNode;
};

type GridReloadPayload = {
  ok: boolean;
  wall?: GridColumnData["wall"];
  featuredCards?: GridCard[];
  pinnedCards?: GridCard[];
  cards?: GridCard[];
  nextCursor?: string | null;
  totalCount?: number;
  cardsIndex?: React.ComponentProps<typeof CardDetailPanelWithQuery>["cardsIndex"];
};

const classStateLabel: Record<Board["class_state"], string> = {
  idle: "대기",
  live: "진행",
  ended: "종료",
};

function CopyButton({ value, disabled }: { value: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy", error);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:text-gray-400"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function ClassStateBadge({ state }: { state: Board["class_state"] }) {
  const styles =
    state === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : state === "ended"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-gray-200 bg-white text-gray-700";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>
      수업 {classStateLabel[state]}
    </span>
  );
}

function WallMenu({
  boardId,
  wallId,
}: {
  boardId: string;
  wallId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuKey, setMenuKey] = useState(0);

  const handleDelete = async () => {
    if (isDeleting) return;
    const confirmed = window.confirm("담벼락을 삭제할까요? 카드가 함께 삭제됩니다.");
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    const response = await fetch(apiV1Path(`dashboard/walls/${wallId}`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId }),
    });
    setIsDeleting(false);
    setMenuKey((prev) => prev + 1);
    if (!response.ok) {
      return;
    }
    router.refresh();
  };

  return (
    <MoreMenu key={menuKey} label="담벼락 메뉴">
      <Link
        href={`/dashboard/boards/${boardId}/walls/${wallId}/edit`}
        className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        담벼락 편집
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed"
      >
        삭제하기
      </button>
    </MoreMenu>
  );
}

export default function TeacherGridBoard({
  board,
  boardId,
  columns,
  cardsIndex,
  shareCode,
  shareEnabled,
  initialCardId,
  settingsContent,
}: TeacherGridBoardProps) {
  const showRuntimeBadge =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_BOARD_RUNTIME_DEBUG === "1";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [boardState, setBoardState] = useState(board);
  const [columnsState, setColumnsState] = useState(columns);
  const [cardsIndexState, setCardsIndexState] = useState(cardsIndex);
  const [activeWallId, setActiveWallId] = useState(columns[0]?.wall.id ?? "");
  const [dragWallId, setDragWallId] = useState<string | null>(null);
  const [tabDragId, setTabDragId] = useState<string | null>(null);
  const [fileDropWallId, setFileDropWallId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelWallId, setPanelWallId] = useState(columns[0]?.wall.id ?? "");
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDrawerSignal, setFileDrawerSignal] = useState(0);
  const [loadingWallIds, setLoadingWallIds] = useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [undoEntry, setUndoEntry] = useState<BulkUndoEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const columnsRef = useRef(columns);
  const inflightReloadsRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    density,
    setDensity,
    autoLoad,
    setAutoLoad,
    searchQuery,
    setSearchQuery,
    authorFilter,
    setAuthorFilter,
    attachmentsOnly,
    setAttachmentsOnly,
    includeHidden,
    setIncludeHidden,
    pinnedOnly,
    setPinnedOnly,
    updatedToday,
    setUpdatedToday,
  } = useBoardPrefs(boardId);

  useEffect(() => {
    setColumnsState(columns);
    setSelectedCardIds((prev) => {
      const allIds = new Set(columns.flatMap((column) => [
        ...column.featuredCards,
        ...column.pinnedCards,
        ...column.cards,
      ].map((card) => card.id)));
      const next = new Set([...prev].filter((id) => allIds.has(id)));
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  }, [columns]);

  useEffect(() => {
    setCardsIndexState(cardsIndex);
  }, [cardsIndex]);

  useEffect(() => {
    columnsRef.current = columnsState;
  }, [columnsState]);

  const shareAvailable = shareEnabled && Boolean(shareCode);
  const sharePathBase = shareCode ? buildStudentUrl(`/s/${shareCode}`) : "";
  const shareUrl = shareCode ? buildShareUrl(shareCode) : "";
  const entryUrl = buildJoinUrl();
  const currentWallId = activeWallId || columnsState[0]?.wall.id;
  const slideUrl = currentWallId ? `${sharePathBase}/walls/${currentWallId}/present/slides` : "";
  const writeLocked = !boardState.share_write_enabled || boardState.class_state === "ended";

  const reloadWall = useCallback(
    async (wallId: string) => {
      if (!wallId || inflightReloadsRef.current.has(wallId)) return;
      inflightReloadsRef.current.add(wallId);
      try {
        const params = new URLSearchParams({
          boardId,
          includeHidden: String(includeHidden),
        });
        const response = await fetch(
          apiV1Path(`dashboard/walls/${wallId}/grid?${params.toString()}`),
        );
        if (!response.ok) return;
        const payload = (await response.json()) as GridReloadPayload;
        if (!payload.ok || !payload.wall) return;

        const currentColumn = columnsRef.current.find((item) => item.wall.id === wallId);
        if (!currentColumn) return;
        const existingIds = new Set(
          [
            ...currentColumn.featuredCards,
            ...currentColumn.pinnedCards,
            ...currentColumn.cards,
          ].map((card) => card.id),
        );

        setColumnsState((prev) =>
          prev.map((item) =>
            item.wall.id === wallId
              ? {
                  wall: payload.wall ?? item.wall,
                  featuredCards: payload.featuredCards ?? [],
                  pinnedCards: payload.pinnedCards ?? [],
                  cards: payload.cards ?? [],
                  nextCursor: payload.nextCursor ?? null,
                  totalCount: payload.totalCount ?? item.totalCount,
                }
              : item,
          ),
        );

        if (payload.cardsIndex) {
          setCardsIndexState((prev) => {
            const next = prev.filter((card) => !existingIds.has(card.id));
            const merged = new Map(next.map((card) => [card.id, card]));
            payload.cardsIndex?.forEach((card) => merged.set(card.id, card));
            return Array.from(merged.values());
          });
        }
      } finally {
        inflightReloadsRef.current.delete(wallId);
      }
    },
    [boardId, includeHidden],
  );

  useWallRealtime(
    columnsState.map((column) => column.wall.id),
    reloadWall,
  );

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.type === "card:created") {
        reloadWall(event.payload.wallId);
        return;
      }
      if (event.type === "card:moved") {
        reloadWall(event.payload.fromWallId);
        reloadWall(event.payload.toWallId);
        return;
      }
      if (event.type === "card:updated") {
        reloadWall(event.payload.wallId);
        return;
      }
      if (event.type === "wall:reordered") {
        const order = event.payload.order;
        setColumnsState((prev) => {
          const map = new Map(prev.map((column) => [column.wall.id, column] as const));
          const next: GridColumnData[] = [];
          order.forEach((id) => {
            const column = map.get(id);
            if (column) next.push(column);
          });
          prev.forEach((column) => {
            if (!order.includes(column.wall.id)) {
              next.push(column);
            }
          });
          return next;
        });
        return;
      }
      if (event.type === "wall:created") {
        setColumnsState((prev) => {
          if (prev.some((column) => column.wall.id === event.payload.wall.id)) {
            return prev;
          }
          return [
            ...prev,
            {
              wall: event.payload.wall,
              featuredCards: [],
              pinnedCards: [],
              cards: [],
              nextCursor: null,
              totalCount: 0,
            },
          ];
        });
        return;
      }
      if (event.type === "class:state_changed") {
        setBoardState((prev) => ({ ...prev, class_state: event.payload.classState as typeof prev.class_state }));
        return;
      }
      if (event.type === "notice_updated") {
        setBoardState((prev) => ({ ...prev, class_notice: event.payload.notice ?? null }));
        return;
      }
      if (event.type === "rules_updated") {
        setBoardState((prev) => ({ ...prev, rules_text: event.payload.rules ?? null }));
      }
    },
    [reloadWall],
  );

  const { status, statusLabel } = useRealtimeClient({
    boardId,
    shareCode,
    role: "teacher",
    onEvent: handleRealtimeEvent,
  });

  const cardCounts = useMemo(
    () =>
      columnsState.reduce<Record<string, number>>((acc, column) => {
        acc[column.wall.id] = column.totalCount;
        return acc;
      }, {}),
    [columnsState],
  );

  const reorderColumns = (
    current: GridColumnData[],
    sourceId: string,
    targetId: string,
  ) => {
    const sourceIndex = current.findIndex((column) => column.wall.id === sourceId);
    const targetIndex = current.findIndex((column) => column.wall.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return current;
    }
    const next = [...current];
    const [moved] = next.splice(sourceIndex, 1);
    if (!moved) {
      return current;
    }
    next.splice(targetIndex, 0, moved);
    return next;
  };

  const persistWallOrder = async (nextColumns: GridColumnData[], prevColumns: GridColumnData[]) => {
    const wallIds = nextColumns.map((column) => column.wall.id);
    const response = await fetch(apiV1Path(`dashboard/boards/${boardId}/walls/reorder`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallIds }),
    });

    if (!response.ok) {
      setColumnsState(prevColumns);
    }
  };

  const handleTabDragStart = (wallId: string) => (event: React.DragEvent) => {
    setTabDragId(wallId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", wallId);
  };

  const handleTabDragOver = (wallId: string) => (event: React.DragEvent) => {
    if (!tabDragId || tabDragId === wallId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleTabDrop = (wallId: string) => async (event: React.DragEvent) => {
    event.preventDefault();
    const sourceId = tabDragId ?? event.dataTransfer.getData("text/plain");
    setTabDragId(null);
    if (!sourceId || sourceId === wallId) return;
    const prevColumns = columnsState;
    const nextColumns = reorderColumns(prevColumns, sourceId, wallId);
    if (nextColumns === prevColumns) return;
    setColumnsState(nextColumns);
    await persistWallOrder(nextColumns, prevColumns);
  };

  const handleTabDragEnd = () => {
    setTabDragId(null);
  };

  useEffect(() => {
    if (!columnsState.find((column) => column.wall.id === activeWallId)) {
      setActiveWallId(columnsState[0]?.wall.id ?? "");
    }
  }, [activeWallId, columnsState]);

  useEffect(() => {
    if (!columnsState.find((column) => column.wall.id === panelWallId)) {
      setPanelWallId(columnsState[0]?.wall.id ?? "");
    }
  }, [columnsState, panelWallId]);

  const handleScroll = () => {
    if (rafRef.current) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const container = scrollRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      let closestId = activeWallId;
      let closestDistance = Number.POSITIVE_INFINITY;
      columnsState.forEach((column) => {
        const node = columnRefs.current[column.wall.id];
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.left - containerRect.left);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = column.wall.id;
        }
      });
      if (closestId !== activeWallId) {
        setActiveWallId(closestId);
      }
    });
  };

  const handleTabClick = (wallId: string) => {
    setActiveWallId(wallId);
    const node = columnRefs.current[wallId];
    node?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const buildCardHref = (cardId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("card", cardId);
    return `${pathname}?${params.toString()}`;
  };

  const clearCardQuery = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("card")) return;
    params.delete("card");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, card: GridCard) => {
    setIsDraggingCard(true);
    event.dataTransfer.setData("text/plain", JSON.stringify({ cardId: card.id, wallId: card.wallId }));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleCardDragEnd = () => {
    setIsDraggingCard(false);
  };

  const insertBoardFile = async (fileId: string, targetWallId: string) => {
    const response = await fetch(apiV1Path(`boards/${boardId}/files/${fileId}/insert`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallId: targetWallId }),
    });
    if (!response.ok) {
      return;
    }
    router.refresh();
  };

  const handleDropCard = async (event: React.DragEvent<HTMLDivElement>, targetWallId: string) => {
    if (event.dataTransfer.types.includes("Files")) return;
    const filePayload = event.dataTransfer.getData("application/x-board-file");
    if (filePayload) {
      event.preventDefault();
      setDragWallId(null);
      setIsDraggingCard(false);
      try {
        const parsed = JSON.parse(filePayload) as { fileId?: string };
        if (parsed.fileId) {
          await insertBoardFile(parsed.fileId, targetWallId);
        }
      } catch (error) {
        console.error(error);
      }
      return;
    }
    event.preventDefault();
    setDragWallId(null);
    setIsDraggingCard(false);
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    const parsed = JSON.parse(payload) as { cardId?: string; wallId?: string };
    if (!parsed.cardId || !parsed.wallId || parsed.wallId === targetWallId) {
      return;
    }
    const response = await fetch(apiV1Path(`dashboard/cards/${parsed.cardId}/move`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallId: targetWallId, boardId }),
    });
    if (!response.ok) {
      return;
    }
    router.refresh();
  };

  const handleFileDrop = (files: File[], wallId: string | null) => {
    const resolvedWallId = wallId || activeWallId || columnsState[0]?.wall.id || "";
    if (!resolvedWallId || files.length === 0) return;
    clearCardQuery();
    setPanelWallId(resolvedWallId);
    setPendingFiles(files);
    setIsPanelOpen(true);
  };

  const handleOpenPanel = (wallId: string) => {
    clearCardQuery();
    setPanelWallId(wallId);
    setIsPanelOpen(true);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedAuthor = authorFilter.trim().toLowerCase();

  const { filteredColumns, matchCount } = useMemo(() => {
    let matches = 0;
    const now = new Date();
    const isToday = (value: string) => {
      const date = new Date(value);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };
    const filterCard = (card: GridCard) => {
      if (!includeHidden && card.isHidden) return false;
      if (attachmentsOnly && !card.hasAttachments) return false;
      if (pinnedOnly && !card.isPinned && !card.isFeatured) return false;
      if (updatedToday && !isToday(card.createdAt)) return false;
      if (normalizedAuthor) {
        const author = card.authorName?.toLowerCase() ?? "";
        if (!author.includes(normalizedAuthor)) return false;
      }
      if (normalizedSearch) {
        const haystack = `${card.text} ${card.authorName ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    };

    const nextColumns = columnsState.map((column) => {
      const featuredCards = column.featuredCards.filter(filterCard);
      const pinnedCards = column.pinnedCards.filter(filterCard);
      const cards = column.cards.filter(filterCard);
      if (normalizedSearch) {
        matches += featuredCards.length + pinnedCards.length + cards.length;
      }
      return { ...column, featuredCards, pinnedCards, cards };
    });

    return { filteredColumns: nextColumns, matchCount: matches };
  }, [attachmentsOnly, columnsState, includeHidden, normalizedAuthor, normalizedSearch, pinnedOnly, updatedToday]);

  const handleLoadMore = async (wallId: string) => {
    if (loadingWallIds[wallId]) return;
    const column = columnsState.find((item) => item.wall.id === wallId);
    if (!column?.nextCursor) return;

    setLoadingWallIds((prev) => ({ ...prev, [wallId]: true }));
    try {
      const params = new URLSearchParams({
        boardId,
        cursor: column.nextCursor,
        limit: "40",
        includeHidden: String(includeHidden),
      });
      const response = await fetch(apiV1Path(`dashboard/walls/${wallId}/cards?${params.toString()}`));
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        ok: boolean;
        items?: Array<{
          id: string;
          wallId: string;
          text: string;
          authorName: string | null;
          authorType?: "teacher" | "student" | null;
          createdAt: string;
          isHidden: boolean;
          isPinned: boolean;
          isFeatured: boolean;
          cardColorToken: CardColorToken | null;
          hasAttachments?: boolean;
          files?: React.ComponentProps<typeof CardDetailPanelWithQuery>["cardsIndex"][number]["files"];
          externalAttachments?: React.ComponentProps<
            typeof CardDetailPanelWithQuery
          >["cardsIndex"][number]["externalAttachments"];
        }>;
        nextCursor?: string | null;
      };

      if (!payload.ok || !payload.items) {
        return;
      }

      const newGridCards = payload.items.map((card) => ({
        id: card.id,
        wallId: card.wallId,
        text: card.text,
        authorName: card.authorName,
        createdAt: card.createdAt,
        isHidden: card.isHidden,
        isPinned: card.isPinned,
        isFeatured: card.isFeatured,
        cardColorToken: card.cardColorToken,
        hasAttachments: card.hasAttachments,
      }));

      setColumnsState((prev) =>
        prev.map((item) => {
          if (item.wall.id !== wallId) return item;
          const existingIds = new Set(item.cards.map((card) => card.id));
          const nextCards = [
            ...item.cards,
            ...newGridCards.filter((card) => !existingIds.has(card.id)),
          ];
          return {
            ...item,
            cards: nextCards,
            nextCursor: payload.nextCursor ?? null,
          };
        }),
      );

      setCardsIndexState((prev) => {
        const existingIds = new Set(prev.map((card) => card.id));
        const next = [...prev];
        payload.items?.forEach((card) => {
          if (existingIds.has(card.id)) return;
          existingIds.add(card.id);
          next.push({
            id: card.id,
            text: card.text,
            authorName: card.authorName ?? undefined,
            authorType: card.authorType,
            createdAt: card.createdAt,
            isHidden: card.isHidden,
            isPinned: card.isPinned,
            isFeatured: card.isFeatured,
            cardColorToken: card.cardColorToken,
            files: card.files,
            externalAttachments: card.externalAttachments,
          });
        });
        return next;
      });
    } finally {
      setLoadingWallIds((prev) => ({ ...prev, [wallId]: false }));
    }
  };

  const columnGapClass =
    density === "s" ? "gap-3" : density === "l" ? "gap-6" : "gap-4";

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  };

  const handleBoardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) return;

    if (event.key === "Escape" && (selectedCardIds.size > 0 || selectionMode)) {
      event.preventDefault();
      const next = reduceGridSelection(
        { selectionMode, selectedCardIds },
        { type: "esc" },
      );
      setSelectionMode(next.selectionMode);
      setSelectedCardIds(next.selectedCardIds);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      const allIds = columnsRef.current.flatMap((column) => [
        ...column.featuredCards,
        ...column.pinnedCards,
        ...column.cards,
      ].map((card) => card.id));
      const next = reduceGridSelection(
        { selectionMode, selectedCardIds },
        { type: "select_all", cardIds: allIds },
      );
      setSelectionMode(next.selectionMode);
      setSelectedCardIds(next.selectedCardIds);
      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && selectedCardIds.size > 0) {
      event.preventDefault();
      handleBatchDelete();
    }
  };

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("button, a, input, textarea, select, [role='button']")
    ) {
      return;
    }
    boardRef.current?.focus({ preventScroll: true });
  };

  const handleHotkeyCompose = () => {
    const targetWallId = activeWallId || columnsState[0]?.wall.id || "";
    if (!targetWallId || writeLocked) return;
    handleOpenPanel(targetWallId);
  };

  const handleHotkeyClose = () => {
    setIsPanelOpen(false);
    clearCardQuery();
  };

  const toggleCardSelection = (cardId: string) => {
    const next = reduceGridSelection(
      { selectionMode, selectedCardIds },
      { type: "toggle_card", cardId },
    );
    setSelectionMode(next.selectionMode);
    setSelectedCardIds(next.selectedCardIds);
  };

  const selectedCardsMeta = useMemo(() => {
    const cards: GridCard[] = [];
    const selectedIds = selectedCardIds;
    columnsState.forEach((column) => {
      const allCards = [
        ...column.featuredCards,
        ...column.pinnedCards,
        ...column.cards,
      ];
      allCards.forEach((card) => {
        if (selectedIds.has(card.id)) {
          cards.push(card);
        }
      });
    });
    const someHidden = cards.some((card) => card.isHidden);
    const someVisible = cards.some((card) => !card.isHidden);
    const somePinned = cards.some((card) => card.isPinned);
    const someUnpinned = cards.some((card) => !card.isPinned);
    return { cards, someHidden, someVisible, somePinned, someUnpinned };
  }, [columnsState, selectedCardIds]);

  const updateCardsIndex = useCallback(
    (updates: Record<string, Partial<CardDetailPanelCard> | null>) =>
      setCardsIndexState((prev) => {
        const map = new Map(prev.map((item) => [item.id, item] as const));
        Object.entries(updates).forEach(([id, update]) => {
          if (update === null) {
            map.delete(id);
            return;
          }
          const existing = map.get(id);
          if (existing) {
            map.set(id, { ...existing, ...(update as Record<string, unknown>) });
          }
        });
        return Array.from(map.values());
      }),
    [],
  );

  const applyCardUpdatesToColumns = useCallback(
    (updates: Record<string, Partial<GridCard> & { wallId?: string } | null>) => {
      setColumnsState((prev) =>
        prev.map((column) => {
          const existingCards = [
            ...column.featuredCards,
            ...column.pinnedCards,
            ...column.cards,
          ];

          const remaining = existingCards
            .filter((card) => {
              const update = updates[card.id];
              if (update === null) return false;
              if (update?.wallId && update.wallId !== column.wall.id) return false;
              return true;
            })
            .map((card) => {
              const update = updates[card.id];
              if (!update) return card;
              return { ...card, ...update, wallId: update.wallId ?? card.wallId };
            });

          const incoming = Object.entries(updates)
            .filter(([, update]) => update && update.wallId === column.wall.id)
            .map(([id, update]) => {
              const base = existingCards.find((card) => card.id === id);
              return { ...base, id, wallId: column.wall.id, ...(update as Partial<GridCard>) } as GridCard;
            })
            .filter((card) => !remaining.some((item) => item.id === card.id));

          const merged = [...incoming, ...remaining];
          const featuredCards = merged.filter((card) => card.isFeatured);
          const pinnedCards = merged.filter((card) => !card.isFeatured && card.isPinned);
          const cards = merged.filter((card) => !card.isFeatured && !card.isPinned);

          return { ...column, featuredCards, pinnedCards, cards };
        }),
      );
    },
    [],
  );

  const executeBatchAction = useCallback(
    async (
      cardIds: string[],
      action: "move" | "color" | "pin" | "hide" | "delete",
      payload?: Record<string, unknown>,
      optimisticUpdates?: Record<string, Partial<GridCard> & { wallId?: string } | null>,
    ) => {
      if (cardIds.length === 0) return false;
      try {
        applyCardUpdatesToColumns(optimisticUpdates ?? {});
        const response = await fetch(apiV1Path("dashboard/cards/batch"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, cardIds, action, payload }),
        });
        const result = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.error ?? "요청이 실패했습니다.");
        }
        return true;
      } catch (error) {
        console.error(error);
        await reloadWall(activeWallId);
        return false;
      }
    },
    [activeWallId, applyCardUpdatesToColumns, boardId, reloadWall],
  );

  const handleBatchAction = useCallback(
    async (
      action: "move" | "color" | "pin" | "hide" | "delete",
      payload?: Record<string, unknown>,
      optimisticUpdates?: Record<string, Partial<GridCard> & { wallId?: string } | null>,
    ) => {
      const cardIds = Array.from(selectedCardIds);
      return executeBatchAction(cardIds, action, payload, optimisticUpdates);
    },
    [executeBatchAction, selectedCardIds],
  );

  const runUndoAction = useCallback(async () => {
    const popped = popOneDeepUndo(undoEntry);
    if (!popped.entry) return;
    setUndoEntry(popped.next);

    if (popped.entry.kind === "move") {
      const grouped = Object.entries(popped.entry.fromWallIdByCardId).reduce<Record<string, string[]>>((acc, [cardId, wallId]) => {
        acc[wallId] = [...(acc[wallId] ?? []), cardId];
        return acc;
      }, {});

      const results = await Promise.all(
        Object.entries(grouped).map(async ([wallId, cardIds]) => {
          const updates = cardIds.reduce<Record<string, Partial<GridCard> & { wallId: string }>>((acc, cardId) => {
            acc[cardId] = { wallId };
            return acc;
          }, {});
          return executeBatchAction(cardIds, "move", { wallId }, updates);
        }),
      );

      if (results.every(Boolean)) {
        pushDashboardToast({ title: "이동을 되돌렸어요" });
      }
      return;
    }

    const responseList = await Promise.all(
      popped.entry.cardIds.map(async (cardId) => {
        const response = await fetch(apiV1Path(`dashboard/cards/${cardId}/restore`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        return response.ok;
      }),
    );

    if (responseList.every(Boolean)) {
      await Promise.all(columnsRef.current.map((column) => reloadWall(column.wall.id)));
      pushDashboardToast({ title: "삭제를 되돌렸어요" });
    }
  }, [executeBatchAction, reloadWall, undoEntry]);

  const openUndoToast = useCallback((title: string) => {
    const toastId = pushDashboardToast({
      title,
      actionLabel: "되돌리기",
      onAction: () => {
        dismissDashboardToast(toastId);
        void runUndoAction();
      },
    });
  }, [runUndoAction]);

  const handleBatchDelete = useCallback(async () => {
    const confirmed = window.confirm("선택한 카드를 삭제할까요?");
    if (!confirmed) return;
    const updates: Record<string, null> = {};
    const cardIds = Array.from(selectedCardIds);
    cardIds.forEach((id) => {
      updates[id] = null;
    });
    const ok = await executeBatchAction(cardIds, "delete", {}, updates);
    if (!ok) return;

    setUndoEntry((prev) => pushOneDeepUndo(prev, { kind: "delete", cardIds }));
    setSelectedCardIds(new Set());
    setSelectionMode(false);
    updateCardsIndex(updates);
    openUndoToast(`${cardIds.length}개 카드를 삭제했어요`);
  }, [executeBatchAction, openUndoToast, selectedCardIds, updateCardsIndex]);

  const handleMoveSelected = async (wallId: string) => {
    if (!wallId) return;
    const updates: Record<string, Partial<GridCard> & { wallId: string }> = {};
    const fromWallIdByCardId: Record<string, string> = {};
    columnsRef.current.forEach((column) => {
      const allCards = [
        ...column.featuredCards,
        ...column.pinnedCards,
        ...column.cards,
      ];
      allCards.forEach((card) => {
        if (selectedCardIds.has(card.id)) {
          fromWallIdByCardId[card.id] = column.wall.id;
          updates[card.id] = { ...card, wallId };
        }
      });
    });
    const cardIds = Object.keys(updates);
    const ok = await executeBatchAction(cardIds, "move", { wallId }, updates);
    if (!ok) return;

    setUndoEntry((prev) =>
      pushOneDeepUndo(prev, {
        kind: "move",
        cardIds,
        fromWallIdByCardId,
        toWallId: wallId,
      }),
    );

    updateCardsIndex(
      cardIds.reduce<Record<string, Partial<CardDetailPanelCard>>>(
        (acc, id) => ({ ...acc, [id]: {} }),
        {},
      ),
    );
    setSelectedCardIds(new Set());
    setSelectionMode(false);
    openUndoToast(`${cardIds.length}개 카드를 이동했어요`);
  };

  const handleColorSelected = async (token: CardColorToken | null) => {
    const updates: Record<string, Partial<GridCard>> = {};
    selectedCardIds.forEach((id) => {
      updates[id] = { cardColorToken: token ?? "default" } as Partial<GridCard>;
    });
    await handleBatchAction("color", { cardColorToken: token }, updates);
    updateCardsIndex(
      Object.keys(updates).reduce<Record<string, Partial<CardDetailPanelCard>>>(
        (acc, id) => ({ ...acc, [id]: { cardColorToken: token ?? undefined } }),
        {},
      ),
    );
  };

  const handleTogglePinSelected = async (pinned: boolean) => {
    const updates: Record<string, Partial<GridCard>> = {};
    selectedCardIds.forEach((id) => {
      updates[id] = { isPinned: pinned };
    });
    await handleBatchAction("pin", { pinned }, updates);
    updateCardsIndex(
      Object.keys(updates).reduce<Record<string, Partial<CardDetailPanelCard>>>(
        (acc, id) => ({ ...acc, [id]: { isPinned: pinned } }),
        {},
      ),
    );
  };

  const handleToggleHideSelected = async (hidden: boolean) => {
    const updates: Record<string, Partial<GridCard>> = {};
    selectedCardIds.forEach((id) => {
      updates[id] = { isHidden: hidden };
    });
    await handleBatchAction("hide", { hidden }, updates);
    updateCardsIndex(
      Object.keys(updates).reduce<Record<string, Partial<CardDetailPanelCard>>>(
        (acc, id) => ({ ...acc, [id]: { isHidden: hidden } }),
        {},
      ),
    );
  };


  const boardDiagnostics = useMemo(() => {
    const allCards = columnsState.flatMap((column) => [
      ...column.featuredCards,
      ...column.pinnedCards,
      ...column.cards,
    ]);
    const externalUrlAttachments = allCards.reduce((count, card) => count + (card.hasAttachments ? 1 : 0), 0);

    return {
      runtimeOwner: "teacher-grid-board-client",
      hasBoardId: boardId.trim().length > 0,
      sections: columnsState.length,
      cards: allCards.length,
      cardsWithUploadedFiles: 0,
      uploadedFileAttachments: 0,
      externalUrlAttachments,
      scrollModel: "native-v2",
      dragModel: "mouse-distance-v2",
      attachmentPathEnabled: false,
    };
  }, [boardId, columnsState]);

  const toasts = useDashboardToasts();

  const handleCardUpdated = (card: CardDetailPanelCard) => {
    const updates: Record<string, Partial<GridCard>> = {
      [card.id]: { text: card.text, cardColorToken: card.cardColorToken ?? null },
    };
    applyCardUpdatesToColumns(updates);
    updateCardsIndex({ [card.id]: card });
  };

  return (
    <div
      ref={boardRef}
      data-runtime-owner="teacher-grid-board-client"
      tabIndex={0}
      onKeyDown={handleBoardKeyDown}
      onPointerDownCapture={handleBoardPointerDown}
      className="relative focus:outline-none"
    >
      {showRuntimeBadge ? (
        <div className="pointer-events-none fixed left-3 top-3 z-[120] space-y-1 rounded-md border border-amber-300 bg-amber-50/95 px-2 py-1 text-[11px] font-semibold text-amber-700 shadow-sm">
          <p>Runtime: TeacherGridBoard</p>
          <p>Board ID present: {boardDiagnostics.hasBoardId ? "yes" : "no"}</p>
          <p>Sections: {boardDiagnostics.sections}</p>
          <p>Cards: {boardDiagnostics.cards}</p>
          <p>Cards with uploaded files: {boardDiagnostics.cardsWithUploadedFiles}</p>
          <p>Uploaded files: {boardDiagnostics.uploadedFileAttachments}</p>
          <p>External links: {boardDiagnostics.externalUrlAttachments}</p>
          <p>Scroll: {boardDiagnostics.scrollModel}</p>
          <p>Drag: {boardDiagnostics.dragModel}</p>
          <p>Attachment path: {boardDiagnostics.attachmentPathEnabled ? "enabled" : "disabled"}</p>
        </div>
      ) : null}
      <GridHotkeys
        containerRef={boardRef}
        searchInputRef={searchInputRef}
        onOpenCompose={handleHotkeyCompose}
        composeEnabled={!writeLocked}
        onClosePanels={handleHotkeyClose}
      />
      {toasts.length > 0 ? (
        <div className="fixed right-4 top-4 z-40 flex w-[min(360px,90vw)] flex-col gap-2">
          {toasts.map((toast) => (
            <div key={toast.id} className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              {toast.description ? <p className="text-xs text-gray-600">{toast.description}</p> : null}
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  onClick={toast.onAction}
                  className="mt-2 text-xs font-semibold text-indigo-600 underline"
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {selectionMode && selectedCardIds.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-30 w-[min(1100px,94vw)] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                선택 {selectedCardIds.size}개
              </span>
              <button
                type="button"
                onClick={() => { const next = reduceGridSelection({ selectionMode, selectedCardIds }, { type: "clear" }); setSelectionMode(next.selectionMode); setSelectedCardIds(next.selectedCardIds); }}
                className="text-xs font-semibold text-gray-600 underline"
              >
                선택 해제
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-700">
              <div className="flex items-center gap-2">
                <label htmlFor="move-wall" className="text-gray-600">
                  이동
                </label>
                <select
                  id="move-wall"
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800"
                  onChange={(event) => handleMoveSelected(event.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    담벼락 선택
                  </option>
                  {columnsState.map((column) => (
                    <option key={column.wall.id} value={column.wall.id}>
                      {column.wall.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-gray-600">색상</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleColorSelected(null)}
                    className="h-6 w-6 rounded-full border border-gray-200 bg-white"
                    aria-label="기본 색상"
                  />
                  {CARD_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.token}
                      type="button"
                      onClick={() => handleColorSelected(option.token)}
                      className={`${option.className} h-6 w-6 rounded-full border border-gray-200`}
                      aria-label={`${option.label} 색상`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTogglePinSelected(!(selectedCardsMeta.somePinned && !selectedCardsMeta.someUnpinned))}
                className="rounded-full border border-amber-200 px-3 py-1 text-amber-700 transition hover:bg-amber-50"
              >
                {selectedCardsMeta.somePinned && !selectedCardsMeta.someUnpinned ? "핀 해제" : "핀"}
              </button>
              <button
                type="button"
                onClick={() => handleToggleHideSelected(!(selectedCardsMeta.someHidden && !selectedCardsMeta.someVisible))}
                className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 transition hover:bg-gray-50"
              >
                {selectedCardsMeta.someHidden && !selectedCardsMeta.someVisible ? "숨김 해제" : "숨김"}
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="rounded-full border border-red-200 px-3 py-1 text-red-600 transition hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <FileDropOverlay
        walls={columnsState.map((column) => ({ id: column.wall.id, title: column.wall.title }))}
        onDropFiles={handleFileDrop}
        onTargetWallChange={setFileDropWallId}
      />

      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{boardState.title}</h1>
                <ClassStateBadge state={boardState.class_state} />
              </div>
              {boardState.description ? (
                <p className="text-sm text-gray-600">{boardState.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>공유 코드: {shareCode ?? "-"}</span>
                <span>· 학생 글쓰기: {writeLocked ? "잠금" : "허용"}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  status === "live"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : status === "reconnecting"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {statusLabel}
              </span>
              <Link
                href={boardHubHref(boardId)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                보드 상세
              </Link>
              <Link
                href={boardClassHref(boardId)}
                prefetch={false}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                수업 화면
              </Link>
              {settingsContent ? (
                <BoardSettingsDrawer title="보드 설정">
                  {settingsContent}
                </BoardSettingsDrawer>
              ) : null}
              <button
                type="button"
                onClick={() => setFileDrawerSignal((prev) => prev + 1)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                파일
              </button>
              {fileDrawerSignal > 0 ? (
                <FileDrawer
                  boardId={boardId}
                  activeWallId={activeWallId}
                  openSignal={fileDrawerSignal}
                  hideTrigger
                  onInsertFile={async (file, wallId) => {
                    const targetWall = wallId || activeWallId || columnsState[0]?.wall.id || "";
                    if (!targetWall) return;
                    await insertBoardFile(file.id, targetWall);
                  }}
                />
              ) : null}
            </div>
          </div>

          {(boardState.class_notice || boardState.rules_text) ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {boardState.class_notice ? (
                <p>
                  <span className="font-semibold">공지:</span> {boardState.class_notice}
                </p>
              ) : null}
              {boardState.rules_text ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">
                  <span className="font-semibold">규칙:</span> {boardState.rules_text}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 md:grid-cols-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-900">공유 링크</p>
                <p className="text-xs text-gray-500">학생 접속(코드 입력): {entryUrl}</p>
                <p className="text-xs text-gray-500">
                  학생 바로 입장: {shareAvailable ? shareUrl : "공유를 켜주세요"}
                </p>
              </div>
              <CopyButton value={shareUrl} disabled={!shareAvailable} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-900">슬라이드</p>
                <p className="text-xs text-gray-500">{shareAvailable ? slideUrl : "공유를 켜주세요"}</p>
              </div>
              <CopyButton value={slideUrl} disabled={!shareAvailable || !currentWallId} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto pb-2">
          {columnsState.map((column) => (
            <button
              key={column.wall.id}
              type="button"
              onClick={() => handleTabClick(column.wall.id)}
              draggable
              onDragStart={handleTabDragStart(column.wall.id)}
              onDragOver={handleTabDragOver(column.wall.id)}
              onDrop={handleTabDrop(column.wall.id)}
              onDragEnd={handleTabDragEnd}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeWallId === column.wall.id
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{column.wall.title}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">
                {cardCounts[column.wall.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-full border border-gray-200 px-3 py-2 shadow-inner">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="/ 로 바로 검색하기"
                  className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                />
              </div>
              <div className="flex min-w-[180px] items-center gap-2 rounded-full border border-gray-200 px-3 py-2">
                <span className="text-xs text-gray-400">작성자</span>
                <input
                  type="text"
                  value={authorFilter}
                  onChange={(event) => setAuthorFilter(event.target.value)}
                  placeholder="이름"
                  className="w-full bg-transparent text-sm text-gray-700 outline-none"
                />
              </div>
              {normalizedSearch ? (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  매칭 {matchCount}건
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[{
                label: "첨부 있음",
                active: attachmentsOnly,
                onToggle: () => setAttachmentsOnly(!attachmentsOnly),
              },
              {
                label: "핀/대표",
                active: pinnedOnly,
                onToggle: () => setPinnedOnly(!pinnedOnly),
              },
              {
                label: "숨김 포함",
                active: includeHidden,
                onToggle: () => setIncludeHidden(!includeHidden),
              },
              {
                label: "오늘 업데이트",
                active: updatedToday,
                onToggle: () => setUpdatedToday(!updatedToday),
              }].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onToggle}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    chip.active
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1">밀도</span>
              {(["s", "m", "l"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDensity(option)}
                  className={`rounded-full px-3 py-1 transition ${
                    density === option
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAutoLoad(!autoLoad)}
              className={`rounded-full border px-3 py-1 transition ${
                autoLoad
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-white"
              }`}
            >
              자동 불러오기 {autoLoad ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {filteredColumns.length === 0 ? (
          <p className="text-sm text-gray-600">아직 담벼락이 없습니다.</p>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={`flex ${columnGapClass} overflow-x-auto pb-6`}
          >
            {filteredColumns.map((column) => (
              <div
                key={column.wall.id}
                ref={(node) => {
                  columnRefs.current[column.wall.id] = node;
                }}
                data-wall-id={column.wall.id}
              >
                <GridColumn
                  boardId={boardId}
                  allowTitleEdit
                  wall={column.wall}
                  featuredCards={column.featuredCards}
                  pinnedCards={column.pinnedCards}
                  cards={column.cards}
                  density={density}
                  dragActive={dragWallId === column.wall.id}
                  fileDropActive={fileDropWallId === column.wall.id}
                  onQuickAdd={writeLocked ? undefined : handleOpenPanel}
                  onActivate={setActiveWallId}
                  isComposeActive={isPanelOpen && panelWallId === column.wall.id}
                  isDraggingCard={isDraggingCard}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes("Files")) return;
                    event.preventDefault();
                    setDragWallId(column.wall.id);
                  }}
                  onDragLeave={() => setDragWallId(null)}
                  onDrop={(event) => handleDropCard(event, column.wall.id)}
                  selectedCardIds={selectedCardIds}
                  onCardClick={(card) => {
                    setIsPanelOpen(false);
                    setPendingFiles([]);
                    router.push(buildCardHref(card.id));
                  }}
                  onCardToggleSelect={(card) => toggleCardSelection(card.id)}
                  onCardDragStart={(event, card) =>
                    handleDragStart(event, {
                      ...card,
                      isHidden: card.isHidden ?? false,
                      isPinned: card.isPinned ?? false,
                      isFeatured: card.isFeatured ?? false,
                    })
                  }
                  onCardDragEnd={handleCardDragEnd}

                  headerActions={
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenPanel(column.wall.id)}
                        disabled={writeLocked}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                        aria-label="카드 작성 패널 열기"
                      >
                        +
                      </button>
                      <WallMenu boardId={boardId} wallId={column.wall.id} />
                    </>
                  }
                  footerActions={
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <Link
                        href={`/dashboard/boards/${boardId}/walls/${column.wall.id}`}
                        className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        담벼락 보기
                      </Link>
                    </div>
                  }
                  emptyMessage="아직 카드가 없습니다. 파일을 끌어 놓거나 카드를 추가해보세요."
                  loadMoreAction={
                    column.nextCursor
                      ? {
                          label: loadingWallIds[column.wall.id]
                            ? "불러오는 중..."
                            : "더 불러오기",
                          onClick: () => handleLoadMore(column.wall.id),
                          disabled: loadingWallIds[column.wall.id],
                        }
                      : undefined
                  }
                  highlightQuery={searchQuery.trim()}
                  autoLoadEnabled={autoLoad}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <CardDetailPanelWithQuery
        cardsIndex={cardsIndexState}
        initialCardId={initialCardId}
        teacherActions={{ boardId, wallId: columnsState[0]?.wall.id ?? "", writeLocked }}
        onCardUpdated={handleCardUpdated}
      />

      {isPanelOpen ? (
        <ComposeCardPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          walls={columnsState.map((column) => ({ id: column.wall.id, title: column.wall.title }))}
          initialWallId={panelWallId}
          initialFiles={pendingFiles}
          onInitialFilesConsumed={() => setPendingFiles([])}
          mode="teacher"
          boardId={boardId}
          writeLocked={writeLocked}
          writeLockedMessage={
            boardState.class_state === "ended"
              ? "수업이 종료되어 지금은 카드 작성을 할 수 없어요."
              : "학생 글쓰기가 잠겨 있어 지금은 작성할 수 없어요."
          }
        />
      ) : null}
    </div>
  );
}
