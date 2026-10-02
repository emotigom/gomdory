"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useMemo, useState, useTransition } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import type { DeletedCard } from "@/lib/data/cards";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

function isWithinRange(deletedAt: string, filter: "all" | "7" | "30") {
  if (filter === "all") return true;

  const deletedTime = new Date(deletedAt).getTime();
  if (Number.isNaN(deletedTime)) return true;

  const days = filter === "7" ? 7 : 30;
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return deletedTime >= threshold;
}

type TrashClientProps = {
  boardId: string;
  canPurge: boolean;
  initialItems: DeletedCard[];
  initialNextCursor: string | null;
};

export default function TrashClient({
  boardId,
  canPurge,
  initialItems,
  initialNextCursor,
}: TrashClientProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [filter, setFilter] = useState<"all" | "7" | "30">("30");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingPurgeId, setConfirmingPurgeId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(
    () => items.filter((item) => isWithinRange(item.deleted_at, filter)),
    [items, filter],
  );

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMessage(null);

    try {
      const response = await fetch(
        apiV1Path(`boards/${boardId}/trash/cards?cursor=${encodeURIComponent(nextCursor)}`),
        { cache: "no-store" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "휴지통을 불러오지 못했습니다.");
      }

      const data = (await response.json()) as {
        ok: boolean;
        items: DeletedCard[];
        nextCursor: string | null;
      };

      if (!data.ok) {
        throw new Error("휴지통을 불러오지 못했습니다.");
      }

      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (error) {
      const text = error instanceof Error ? error.message : "휴지통을 불러오지 못했습니다.";
      setMessage({ tone: "error", text });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRestore = (cardId: string) => {
    setMessage(null);
    setPendingId(cardId);
    startTransition(async () => {
      try {
        const response = await fetch(apiV1Path(`dashboard/cards/${cardId}/restore`), {
          method: "POST",
          cache: "no-store",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "카드를 복구하지 못했습니다.");
        }

        setItems((prev) => prev.filter((item) => item.id !== cardId));
        setMessage({ tone: "success", text: "카드를 복구했습니다." });
      } catch (error) {
        const text = error instanceof Error ? error.message : "카드를 복구하지 못했습니다.";
        setMessage({ tone: "error", text });
      } finally {
        setPendingId(null);
      }
    });
  };

  const handlePurge = (cardId: string) => {
    if (!canPurge) return;
    setMessage(null);

    if (confirmingPurgeId !== cardId) {
      setConfirmingPurgeId(cardId);
      return;
    }

    setPendingId(cardId);
    startTransition(async () => {
      try {
        const response = await fetch(apiV1Path(`dashboard/cards/${cardId}/purge`), {
          method: "DELETE",
          cache: "no-store",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "카드를 영구 삭제하지 못했습니다.");
        }

        setItems((prev) => prev.filter((item) => item.id !== cardId));
        setMessage({ tone: "success", text: "카드를 영구 삭제했습니다." });
      } catch (error) {
        const text = error instanceof Error ? error.message : "카드를 영구 삭제하지 못했습니다.";
        setMessage({ tone: "error", text });
      } finally {
        setPendingId(null);
        setConfirmingPurgeId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-semibold">필터</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="rounded-md border border-gray-200 px-3 py-1 text-sm shadow-sm focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="all">전체</option>
          </select>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">{filteredItems.length}개 표시</span>
        </div>
        {nextCursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        ) : null}
      </div>

      {message ? <InlineAlert tone={message.tone} title={message.text} /> : null}

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          삭제된 카드가 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredItems.map((card) => {
            const isProcessing = pendingId === card.id || isPending;
            const isConfirming = confirmingPurgeId === card.id;

            return (
              <li key={card.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">{card.wall_title}</span>
                      <span>작성자: {card.author_name ?? "알 수 없음"}</span>
                      <span>작성 시각: {formatDate(card.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-3">{card.text || "(내용 없음)"}</p>
                    <p className="text-xs text-gray-500">
                      삭제 시각: {formatDate(card.deleted_at)} / 삭제자: {card.deleted_by ?? "알 수 없음"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestore(card.id)}
                      disabled={isProcessing}
                      className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? "처리 중..." : "복구"}
                    </button>
                    {canPurge ? (
                      <button
                        type="button"
                        onClick={() => handlePurge(card.id)}
                        disabled={isProcessing}
                        className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                          isConfirming
                            ? "border-rose-300 bg-rose-50 text-rose-700 focus-visible:ring-rose-200"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus-visible:ring-gray-200"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isProcessing
                          ? "처리 중..."
                          : isConfirming
                            ? "정말 영구 삭제"
                            : "영구 삭제"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
