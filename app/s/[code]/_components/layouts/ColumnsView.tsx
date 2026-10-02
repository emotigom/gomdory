"use client";

import type { HTMLAttributes } from "react";
import CardTile from "../CardTile";
import type { StudentBoardModel, StudentCard } from "@/lib/student/boardModel";
import { getCardColorClass } from "@/lib/ui/cardColors";
import { isCardColorToken, type CardColorToken } from "@/lib/types/cards";

export default function ColumnsView({
  model,
  onOpen,
  onCompose,
  tvMode,
  writeLocked,
  ...props
}: {
  model: StudentBoardModel;
  onOpen: (card: StudentCard) => void;
  onCompose: (wallId: string) => void;
  tvMode: boolean;
  writeLocked: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const columns = model.columns.length ? model.columns : [];

  if (!columns.length && !model.pinnedCards.length && !model.cards.length) {
    return (
      <div
        className="rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)]/70 p-10 text-center text-[var(--theme-text-muted)]"
        data-view="columns"
        {...props}
      >
        <p className="font-semibold text-[var(--theme-text)]">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-[var(--theme-text)]0">첫 번째 열을 채워볼까요?</p>
        <div className="mt-4 flex justify-center">
          <a
            href="#student-action-bar"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-[var(--theme-accent-text)] transition hover:bg-indigo-700"
          >
            질문/도움 남기기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-view="columns" {...props}>
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
                : "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {model.pinnedCards.map((card) => (
              <CardTile key={card.id} card={card} onOpen={onOpen} variant="columns" tvMode={tvMode} />
            ))}
          </div>
        </section>
      ) : null}

      <div
        className={
          tvMode
            ? "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
            : "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        }
      >
        {columns.map((column) => {
          const colorToken = isCardColorToken(column.uiColorToken ?? "")
            ? (column.uiColorToken as CardColorToken)
            : null;
          const columnWriteLocked = writeLocked || column.studentWriteEnabled === false;
          return (
            <div
              key={column.key}
              className="flex flex-col rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)]/90 shadow-[0_24px_90px_-70px_rgba(15,23,42,0.45)]"
            >
            <div className="sticky top-0 z-10 rounded-t-3xl border-b border-[var(--theme-border)] bg-[var(--theme-card)]/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {colorToken ? (
                    <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${getCardColorClass(colorToken)}`} />
                  ) : null}
                  <p className={tvMode ? "text-lg font-semibold text-[var(--theme-text)]" : "text-base font-semibold text-[var(--theme-text)]"}>
                    {column.title}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--theme-card-muted)] px-3 py-1 text-xs font-semibold text-[var(--theme-text-muted)]">
                  {column.cards.length}개
                </span>
              </div>
            </div>
            <div className={tvMode ? "flex-1 space-y-5 p-5" : "flex-1 space-y-4 p-4"}>
              {column.cards.map((card) => (
                <CardTile key={card.id} card={card} onOpen={onOpen} variant="columns" tvMode={tvMode} />
              ))}
            </div>
            <div className={tvMode ? "border-t border-[var(--theme-border)] p-5" : "border-t border-[var(--theme-border)] p-4"}>
              <button
                type="button"
                disabled={columnWriteLocked}
                onClick={() => onCompose(column.key)}
                className={
                  tvMode
                    ? "flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-4 py-3 text-base font-semibold text-[var(--theme-text-muted)] transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:border-[var(--theme-border)] disabled:bg-[var(--theme-card-muted)] disabled:text-[var(--theme-text-subtle)]"
                    : "flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-4 py-2 text-sm font-semibold text-[var(--theme-text-muted)] transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:border-[var(--theme-border)] disabled:bg-[var(--theme-card-muted)] disabled:text-[var(--theme-text-subtle)]"
                }
              >
                + 카드 작성
              </button>
              {columnWriteLocked ? (
                <p className={tvMode ? "mt-3 text-sm text-[var(--theme-text-subtle)]" : "mt-2 text-xs text-[var(--theme-text-subtle)]"}>
                  {column.studentWriteEnabled === false
                    ? "이 섹션은 제출이 닫혔어요."
                    : "읽기 전용 · 선생님이 열어주면 작성 가능"}
                </p>
              ) : null}
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
