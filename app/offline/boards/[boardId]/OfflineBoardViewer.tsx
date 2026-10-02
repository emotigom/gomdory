"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import GridColumn from "@/app/_components/GridColumn";
import { CardDetailOverlayWithQuery } from "@/app/_components/CardDetailOverlay";
import type { CardDetailOverlayCard } from "@/app/_components/CardDetailOverlay";
import { getOfflineBoardPack } from "@/lib/offline/packStore";
import { parseBoardZip, type OfflineBoardData } from "@/lib/offline/zip";

const density: "s" | "m" | "l" = "m";

type ViewerState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; board: OfflineBoardData; savedAt: string; sizeBytes: number };

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function OfflineBoardViewer({ boardId }: { boardId: string }) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const pack = await getOfflineBoardPack(boardId);
        if (!pack) {
          if (alive) setState({ status: "not-found" });
          return;
        }
        const buffer = await pack.blob.arrayBuffer();
        const board = await parseBoardZip(buffer);
        if (!alive) return;
        setState({ status: "ready", board, savedAt: pack.savedAt, sizeBytes: pack.sizeBytes });
      } catch (error) {
        if (!alive) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "오프라인 보드를 열 수 없습니다.",
        });
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [boardId]);

  const { columns, cardsIndex, urls } = useMemo(() => {
    if (state.status !== "ready") {
      return { columns: [], cardsIndex: [] as CardDetailOverlayCard[], urls: [] as string[] };
    }

    const urlList: string[] = [];
    const cardsIndexMap: CardDetailOverlayCard[] = state.board.cards.map((card) => {
      const files = card.internalFiles.map((file) => {
        const url = URL.createObjectURL(file.blob);
        urlList.push(url);
        return {
          id: file.id,
          filename: file.filename,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          downloadUrl: url,
        };
      });

      return {
        id: card.id,
        text: card.text,
        authorName: card.authorName,
        authorType: card.authorType,
        createdAt: card.createdAt,
        isHidden: card.isHidden,
        isPinned: card.isPinned,
        isFeatured: card.isFeatured,
        cardColorToken: card.cardColorToken,
        files,
        externalAttachments: card.externalAttachments,
      };
    });

    const cardsByWall = new Map<string, typeof state.board.cards>();
    state.board.cards.forEach((card) => {
      const list = cardsByWall.get(card.wallId) ?? [];
      list.push(card);
      cardsByWall.set(card.wallId, list);
    });

    const columns = state.board.walls.map((wall) => {
      const cards = cardsByWall.get(wall.id) ?? [];
      const featuredCards = cards.filter((card) => card.isFeatured);
      const pinnedCards = cards.filter((card) => card.isPinned && !card.isFeatured);
      const regularCards = cards.filter((card) => !card.isPinned && !card.isFeatured);

      return {
        wall,
        featuredCards,
        pinnedCards,
        cards: regularCards,
      };
    });

    return { columns, cardsIndex: cardsIndexMap, urls: urlList };
  }, [state]);

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        오프라인 보드를 불러오는 중...
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">오프라인 보드 없음</h1>
          <p className="mt-2 text-sm text-gray-600">
            저장된 오프라인 팩을 찾지 못했습니다.
          </p>
          <Link
            href="/dashboard/offline"
            className="mt-6 inline-flex rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            오프라인 보드 목록
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-red-700">오프라인 보드 오류</h1>
          <p className="mt-2 text-sm text-red-600">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-gray-900">{state.board.title}</h1>
            <p className="text-xs text-gray-500">
              저장 시각: {new Date(state.savedAt).toLocaleString("ko-KR")} · 용량:
              {" "}
              {formatFileSize(state.sizeBytes)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              오프라인 읽기 전용
            </span>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
            >
              뒤로가기
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {columns.length === 0 ? (
          <p className="text-sm text-gray-600">담벼락이 없습니다.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6">
            {columns.map((column) => (
              <div key={column.wall.id} className="min-w-[280px]">
                <GridColumn
                  wall={{
                    id: column.wall.id,
                    title: column.wall.title,
                    description: null,
                  }}
                  featuredCards={column.featuredCards}
                  pinnedCards={column.pinnedCards}
                  cards={column.cards}
                  density={density}
                  onCardClick={(card) => {
                    router.push(`?card=${card.id}`);
                  }}
                  emptyMessage="카드가 없습니다."
                  minWidthClass="min-w-[260px]"
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <CardDetailOverlayWithQuery cardsIndex={cardsIndex} readOnly />
    </div>
  );
}
