"use client";

import type { RefObject } from "react";

import type { ShareColumnCount } from "./useShareViewPrefs";
import ShareCard from "./ShareCard";

type ShareGridCard = React.ComponentProps<typeof ShareCard>["card"];

type ShareGridProps = {
  cards: ShareGridCard[];
  columnCount: ShareColumnCount;
  tvMode: boolean;
  onCardClick: (cardId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
};

export default function ShareGrid({
  cards,
  columnCount,
  tvMode,
  onCardClick,
  onLoadMore,
  hasMore,
  isLoading,
  sentinelRef,
}: ShareGridProps) {
  const columnClasses =
    columnCount === "auto" ? "columns-1 sm:columns-2 lg:columns-3 2xl:columns-4" : "";

  return (
    <div className="space-y-6">
      <div
        className={`w-full gap-4 ${columnClasses}`}
        style={
          columnCount === "auto"
            ? undefined
            : {
                columnCount,
                columnGap: "1rem",
              }
        }
      >
        {cards.map((card) => (
          <div key={card.id} className="mb-4 break-inside-avoid">
            <ShareCard card={card} tvMode={tvMode} onClick={() => onCardClick(card.id)} />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
              isLoading
                ? "cursor-not-allowed border-slate-200 text-slate-400"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isLoading ? "불러오는 중..." : "더 보기"}
          </button>
        ) : null}
        <div ref={sentinelRef} className="h-6" />
      </div>
    </div>
  );
}
