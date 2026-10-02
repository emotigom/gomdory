"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ShareBoard } from "@/lib/data/share";
import type { CardColorToken } from "@/lib/types/cards";
import { useWallRealtime } from "@/lib/hooks/useWallRealtime";
import { useRealtimeClient } from "@/lib/realtime/client";
import type { RealtimeEvent } from "@/lib/realtime/events";
import { CardDetailPanelWithQuery } from "@/app/_components/cards/CardDetailPanel";
import ComposeCardPanel from "@/app/_components/ComposeCardPanel";
import EmptyState from "@/app/_components/EmptyState";
import InlineAlert from "@/app/_components/InlineAlert";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";

import ShareHeader from "./_components/ShareHeader";
import ShareGrid from "./_components/ShareGrid";
import { useShareViewPrefs } from "./_components/useShareViewPrefs";

type GridCard = {
  id: string;
  wallId: string;
  text: string;
  authorName: string | null;
  createdAt: string;
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
    student_write_enabled?: boolean | null;
  };
  featuredCards: GridCard[];
  pinnedCards: GridCard[];
  cards: GridCard[];
  nextCursor: string | null;
  totalCount: number;
};

type StudentGridBoardProps = {
  board: ShareBoard;
  code: string;
  columns: GridColumnData[];
  cardsIndex: React.ComponentProps<typeof CardDetailPanelWithQuery>["cardsIndex"];
  initialCardId?: string;
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

const INITIAL_BATCH = 36;
const BATCH_SIZE = 30;

export default function StudentGridBoard({
  board,
  code,
  columns,
  cardsIndex,
  initialCardId,
}: StudentGridBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [boardState, setBoardState] = useState(board);
  const [columnsState, setColumnsState] = useState(columns);
  const [cardsIndexState, setCardsIndexState] = useState(cardsIndex);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [panelWallId, setPanelWallId] = useState(columns[0]?.wall.id ?? "");
  const columnsRef = useRef(columnsState);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const tvQuery = searchParams.get("tv") === "1";
  const { columnCount, setColumnCount, sortOrder, setSortOrder, tvMode, setTvMode } =
    useShareViewPrefs(board.id, tvQuery);

  useEffect(() => {
    setColumnsState(columns);
  }, [columns]);

  useEffect(() => {
    setCardsIndexState(cardsIndex);
  }, [cardsIndex]);

  useEffect(() => {
    columnsRef.current = columnsState;
  }, [columnsState]);

  const writeLocked = !boardState.share_write_enabled || boardState.class_state === "ended";

  const shareUrl = `/s/${code}/grid`;

  const totalCardCount = useMemo(
    () => columnsState.reduce((acc, column) => acc + column.totalCount, 0),
    [columnsState],
  );

  const filteredCards = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    const next = normalized
      ? cardsIndexState.filter((card) => {
          const text = card.text?.toLowerCase() ?? "";
          const author = card.authorName?.toLowerCase() ?? "";
          return text.includes(normalized) || author.includes(normalized);
        })
      : cardsIndexState;

    const sorted = [...next].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

    return sorted;
  }, [cardsIndexState, deferredSearch, sortOrder]);

  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [deferredSearch, sortOrder]);

  const visibleCards = filteredCards.slice(0, visibleCount);
  const hasMoreVisible = visibleCount < filteredCards.length;
  const hasMoreServer = columnsState.some((column) => column.nextCursor);
  const hasMore = hasMoreVisible || hasMoreServer;

  const loadMoreWall = useCallback(
    async (column: GridColumnData) => {
      if (!column.nextCursor) return 0;
      const params = new URLSearchParams({
        cursor: column.nextCursor,
        limit: "40",
      });
      const response = await fetchWithRetry(
        apiV1Path(`share/${code}/walls/${column.wall.id}/cards?${params.toString()}`),
      );
      if (!response.ok) return 0;
      const payload = (await response.json()) as {
        ok: boolean;
        items?: Array<{
          id: string;
          wallId: string;
          text: string;
          authorName: string | null;
          authorType?: "teacher" | "student";
          createdAt: string;
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

      if (!payload.ok || !payload.items) return 0;

      const newGridCards = payload.items.map((card) => ({
        id: card.id,
        wallId: card.wallId,
        text: card.text,
        authorName: card.authorName,
        createdAt: card.createdAt,
        isPinned: card.isPinned,
        isFeatured: card.isFeatured,
        cardColorToken: card.cardColorToken,
        hasAttachments: card.hasAttachments,
      }));

      setColumnsState((prev) =>
        prev.map((item) => {
          if (item.wall.id !== column.wall.id) return item;
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
            isPinned: card.isPinned,
            isFeatured: card.isFeatured,
            cardColorToken: card.cardColorToken,
            files: card.files,
            externalAttachments: card.externalAttachments,
          });
        });
        return next;
      });

      return payload.items.length;
    },
    [code],
  );

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;
    if (visibleCount < filteredCards.length) {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredCards.length));
      return;
    }
    if (!hasMoreServer) return;

    setIsLoadingMore(true);
    setNetworkNotice(null);
    try {
      let loaded = 0;
      for (const column of columnsRef.current) {
        if (!column.nextCursor) continue;
        loaded += await loadMoreWall(column);
        if (loaded >= BATCH_SIZE) break;
      }
      if (loaded === 0) {
        setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredCards.length));
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.debug("Share grid load more error:", error);
      }
      setNetworkNotice("네트워크가 불안정해요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [filteredCards.length, hasMoreServer, isLoadingMore, loadMoreWall, visibleCount]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const node = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMore) return;
        void handleLoadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore]);

  const reloadWall = useCallback(
    async (wallId: string) => {
      if (!wallId) return;
      setNetworkNotice(null);
      try {
        const response = await fetchWithRetry(apiV1Path(`share/${code}/walls/${wallId}/grid`));
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
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.debug("Share grid reload error:", error);
        }
        setNetworkNotice("네트워크가 불안정해요. 잠시 후 다시 시도해주세요.");
      }
    },
    [code],
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
            if (!order.includes(column.wall.id)) next.push(column);
          });
          return next;
        });
        return;
      }
      if (event.type === "wall:created") {
        setColumnsState((prev) => {
          if (prev.some((column) => column.wall.id === event.payload.wall.id)) return prev;
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
        setBoardState((prev) => ({
          ...prev,
          class_state: event.payload.classState as typeof prev.class_state,
        }));
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

  useRealtimeClient({
    boardId: board.id,
    shareCode: code,
    role: "student",
    onEvent: handleRealtimeEvent,
  });

  const buildCardHref = (cardId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("card", cardId);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className={`min-h-screen bg-slate-50 ${tvMode ? "text-base" : "text-sm"}`}>
      <ShareHeader
        title={boardState.title}
        description={boardState.description}
        shareCode={boardState.share_code ?? undefined}
        shareUrl={shareUrl}
        totalCount={totalCardCount}
        tvMode={tvMode}
        onToggleTv={() => setTvMode(!tvMode)}
        columnCount={columnCount}
        onColumnChange={setColumnCount}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        {writeLocked ? (
          <InlineAlert
            tone="warning"
            title={
              boardState.class_state === "ended"
                ? "오늘 수업은 종료되었어요. 다음 수업에서 다시 만나요!"
                : "지금은 읽기 전용이에요. 선생님이 잠금을 해제하면 작성할 수 있어요."
            }
          />
        ) : null}

        {networkNotice ? <InlineAlert tone="error" title={networkNotice} /> : null}

        {filteredCards.length === 0 ? (
          <EmptyState
            title="아직 게시물이 없어요"
            description="학생들이 참여할 수 있도록 질문이나 과제를 안내해보세요."
            action={
              writeLocked ? undefined : (
                <button
                  type="button"
                  onClick={() => {
                    setPanelWallId(columnsState[0]?.wall.id ?? "");
                    setIsComposerOpen(true);
                  }}
                  className="student-board-cta inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition"
                >
                  새 글/자료 올리기
                </button>
              )
            }
          />
        ) : (
          <ShareGrid
            cards={visibleCards}
            columnCount={columnCount}
            tvMode={tvMode}
            onCardClick={(cardId) => router.push(buildCardHref(cardId))}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            sentinelRef={sentinelRef}
          />
        )}

        <div className="theme-card-footer-link text-center text-xs">
          <Link href={`/s/${code}`} className="underline">
            담벼락 목록으로 돌아가기
          </Link>
        </div>
      </main>

      <CardDetailPanelWithQuery
        cardsIndex={cardsIndexState}
        initialCardId={initialCardId}
        readOnly
      />

      <ComposeCardPanel
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        walls={columnsState.map((column) => ({
          id: column.wall.id,
          title: column.wall.title,
          studentWriteEnabled: column.wall.student_write_enabled ?? true,
        }))}
        initialWallId={panelWallId}
        mode="student"
        code={code}
        writeLocked={writeLocked}
        writeLockedMessage={
          boardState.class_state === "ended"
            ? "오늘 수업은 종료되었어요. 다음에 다시 만나요!"
            : "지금은 읽기 전용이에요. 선생님이 잠금을 해제하면 작성할 수 있어요."
        }
      />
    </div>
  );
}
