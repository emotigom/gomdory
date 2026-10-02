"use client";

import type { HTMLAttributes } from "react";
import CardTile from "../CardTile";
import type { StudentBoardModel, StudentCard } from "@/lib/student/boardModel";

const isGalleryType = (card: StudentCard) =>
  Boolean(card.thumbUrl) || card.kind === "file" || card.kind === "link";

export default function GalleryView({
  model,
  onOpen,
  tvMode,
  ...props
}: {
  model: StudentBoardModel;
  onOpen: (card: StudentCard) => void;
  tvMode: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const cards = [...model.pinnedCards, ...model.cards]
    .filter(isGalleryType)
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  if (!cards.length) {
    return (
      <div
        className="rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)]/70 p-8 text-center text-[var(--theme-text-muted)]"
        data-view="gallery"
        {...props}
      >
        <p className="font-semibold text-[var(--theme-text)]">보여줄 카드가 없어요.</p>
        <p className="mt-2 text-sm text-[var(--theme-text)]0">이미지나 파일을 올리면 여기서 크게 볼 수 있어요.</p>
        <div className="mt-4 flex justify-center">
          <a
            href="#student-action-bar"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-[var(--theme-accent-text)] transition hover:bg-indigo-700"
          >
            질문/파일 보내기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        tvMode
          ? "grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          : "grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      }
      data-view="gallery"
      {...props}
    >
      {cards.map((card) => (
        <CardTile key={card.id} card={card} onOpen={onOpen} variant="gallery" tvMode={tvMode} />
      ))}
    </div>
  );
}
