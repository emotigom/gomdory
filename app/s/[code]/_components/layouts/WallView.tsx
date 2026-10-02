"use client";

import type { HTMLAttributes } from "react";
import CardTile from "../CardTile";
import type { StudentBoardModel, StudentCard } from "@/lib/student/boardModel";

export default function WallView({
  model,
  onOpen,
  tvMode,
  ...props
}: {
  model: StudentBoardModel;
  onOpen: (card: StudentCard) => void;
  tvMode: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const cards = [...model.pinnedCards, ...model.cards];

  if (!cards.length) {
    return (
      <div
        className="rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)]/70 p-10 text-center text-[var(--theme-text-muted)]"
        data-view="wall"
        {...props}
      >
        <p className="font-semibold text-[var(--theme-text)]">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-[var(--theme-text)]0">첫 질문이나 도움 요청을 남겨보세요.</p>
        <div className="mt-4 flex justify-center">
          <a
            href="#student-action-bar"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-[var(--theme-accent-text)] transition hover:bg-indigo-700"
          >
            질문하기로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-view="wall" {...props}>
      {model.pinnedCards.length ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <span className="text-lg">📌</span>
            <span>고정 카드</span>
          </div>
          <div
            className={
              tvMode
                ? "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
                : "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            }
          >
            {model.pinnedCards.map((card) => (
              <CardTile key={card.id} card={card} onOpen={onOpen} variant="wall" tvMode={tvMode} />
            ))}
          </div>
        </section>
      ) : null}
      <div
        className={
          tvMode
            ? "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            : "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        }
      >
        {model.cards.map((card) => (
          <CardTile key={card.id} card={card} onOpen={onOpen} variant="wall" tvMode={tvMode} />
        ))}
      </div>
    </div>
  );
}
