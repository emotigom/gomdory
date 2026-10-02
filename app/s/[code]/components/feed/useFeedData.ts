"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useState } from "react";

import type { ShareBoard, ShareCard, ShareWall } from "@/lib/data/share";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";
import type { ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";
import { getCardColorClass } from "@/lib/ui/cardColors";

export type FeedCard = {
  id: string;
  wallId: string;
  text: string;
  authorName: string | null;
  authorType: ShareCard["author_type"];
  createdAt: string;
  cardColorToken: CardColorToken | null;
  isPinned: boolean;
  isFeatured: boolean;
  files: {
    id: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    downloadUrl: string;
  }[];
  externalAttachments: ExternalAttachment[];
};

export type FeedWall = {
  wall: ShareWall;
  cards: FeedCard[];
  nextCursor: string | null;
  totalCount: number;
  loadingMore?: boolean;
};

export type FeedPayload = {
  ok: boolean;
  board: ShareBoard;
  walls: FeedWall[];
  error?: string;
};

export type FeedState = {
  loading: boolean;
  error: string | null;
  walls: FeedWall[];
  board: ShareBoard | null;
  wallErrors: Record<string, string | null>;
};

type FetchParams = {
  shareCode: string;
  limit?: number;
};

export function useFeedData({ shareCode, limit = 9 }: FetchParams): {
  state: FeedState;
  reload: () => Promise<void>;
  loadMore: (wallId: string) => Promise<void>;
} {
  const [state, setState] = useState<FeedState>({
    loading: true,
    error: null,
    walls: [],
    board: null,
    wallErrors: {},
  });
  const wallMap = useMemo(
    () => new Map(state.walls.map((item) => [item.wall.id, item] as const)),
    [state.walls],
  );

  useEffect(() => {
    void load();

    async function load() {
      try {
        const response = await fetchWithRetry(
          apiV1Path(`share/${shareCode}/feed?limit=${limit}`),
        );
        const payload = (await response.json()) as FeedPayload;
        if (!payload.ok) {
          throw new Error(payload.error ?? "피드를 불러오지 못했습니다.");
        }
        setState({
          loading: false,
          error: null,
          walls: payload.walls,
          board: payload.board,
          wallErrors: {},
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "피드를 불러오지 못했습니다.",
        }));
      }
    }
  }, [limit, shareCode]);

  const reload = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetchWithRetry(apiV1Path(`share/${shareCode}/feed?limit=${limit}`));
      const payload = (await response.json()) as FeedPayload;
      if (!payload.ok) {
        throw new Error(payload.error ?? "피드를 불러오지 못했습니다.");
      }
      setState({
        loading: false,
        error: null,
        walls: payload.walls,
        board: payload.board,
        wallErrors: {},
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "피드를 불러오지 못했습니다.",
      }));
    }
  };

  const loadMore = async (wallId: string) => {
    const existing = wallMap.get(wallId);
    if (!existing || !existing.nextCursor) return;
    setState((prev) => ({
      ...prev,
      walls: prev.walls.map((wall) =>
        wall.wall.id === wallId ? { ...wall, loadingMore: true } : wall,
      ),
      wallErrors: { ...prev.wallErrors, [wallId]: null },
    }));

    try {
      const response = await fetchWithRetry(
        apiV1Path(`share/${shareCode}/feed/walls/${wallId}?cursor=${existing.nextCursor}&limit=${limit}`),
      );
      const payload = (await response.json()) as {
        ok: boolean;
        wall: FeedWall;
        error?: string;
      };
      if (!payload.ok || !payload.wall) {
        throw new Error(payload.error ?? "더 불러오지 못했습니다.");
      }
      setState((prev) => ({
        ...prev,
        walls: prev.walls.map((wall) =>
          wall.wall.id === wallId
            ? {
                ...payload.wall,
                cards: mergeCards(wall.cards, payload.wall?.cards ?? []),
                loadingMore: false,
              }
            : wall,
        ),
        wallErrors: { ...prev.wallErrors, [wallId]: null },
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "더 불러오지 못했습니다.",
        walls: prev.walls.map((wall) =>
          wall.wall.id === wallId ? { ...wall, loadingMore: false } : wall,
        ),
        wallErrors: {
          ...prev.wallErrors,
          [wallId]: error instanceof Error ? error.message : "더 불러오지 못했습니다.",
        },
      }));
    }
  };

  return { state, reload, loadMore };
}

function mergeCards(existing: FeedCard[], incoming: FeedCard[]) {
  const map = new Map<string, FeedCard>();
  for (const card of existing) {
    map.set(card.id, card);
  }
  for (const card of incoming) {
    map.set(card.id, card);
  }
  return Array.from(map.values());
}

export function getCardPreviewLines(text: string, maxLines = 4): string {
  const lines = text.split("\n").map((line) => line.trim());
  return lines.slice(0, maxLines).join("\n");
}

export function getCardPreviewTone(card: FeedCard) {
  if (card.isFeatured) return "bg-purple-50 border-purple-200";
  if (card.isPinned) return "bg-amber-50 border-amber-200";
  return getCardColorClass(card.cardColorToken);
}
