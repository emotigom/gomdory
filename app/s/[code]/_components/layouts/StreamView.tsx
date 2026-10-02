"use client";

import { useMemo } from "react";
import type { HTMLAttributes } from "react";
import CardTile from "../CardTile";
import type { StudentBoardModel, StudentCard } from "@/lib/student/boardModel";

const KIND_LABELS: Record<StudentCard["kind"], string> = {
  note: "메모",
  file: "파일",
  question: "질문",
  help: "도움",
  poll: "투표",
  pulse: "이해도",
  link: "링크",
};

const KIND_BADGE: Record<StudentCard["kind"], string> = {
  note: "bg-[var(--theme-card-muted)] text-[var(--theme-text-muted)]",
  file: "bg-emerald-100 text-emerald-700",
  question: "bg-sky-100 text-sky-700",
  help: "bg-rose-100 text-rose-700",
  poll: "bg-amber-100 text-amber-700",
  pulse: "bg-indigo-100 text-indigo-700",
  link: "bg-[var(--theme-surface-muted)] text-[var(--theme-accent)]",
};

const sortByTime = (a: StudentCard, b: StudentCard) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const formatRelative = (value: string) => {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "";
  const diffMs = Date.now() - created;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}일 전`;
};

export default function StreamView({
  model,
  onOpen,
  tvMode,
  ...props
}: {
  model: StudentBoardModel;
  onOpen: (card: StudentCard) => void;
  tvMode: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const cards = useMemo(
    () => [...model.cards].sort(sortByTime),
    [model.cards],
  );
  const pinnedCards = useMemo(
    () => [...model.pinnedCards].sort(sortByTime),
    [model.pinnedCards],
  );

  if (!cards.length && !pinnedCards.length) {
    return (
      <div
        className="rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)]/70 p-10 text-center text-[var(--theme-text-muted)]"
        data-view="stream"
        {...props}
      >
        <p className="font-semibold text-[var(--theme-text)]">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-[var(--theme-text)]0">질문/도움/이해도를 남기면 타임라인에 바로 표시돼요.</p>
        <div className="mt-4 flex justify-center">
          <a
            href="#student-action-bar"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-[var(--theme-accent-text)] transition hover:bg-indigo-700"
          >
            액션 바로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={tvMode ? "space-y-6" : "space-y-5"} data-view="stream" {...props}>
      {pinnedCards.length ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <span className="text-lg">📌</span>
            <span>Pinned</span>
          </div>
          {pinnedCards.map((card) => (
            <div key={card.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--theme-text)]0">
                <span className={`rounded-full px-3 py-1 text-[11px] ${KIND_BADGE[card.kind]}`}>
                  {KIND_LABELS[card.kind]}
                </span>
                <span>{formatRelative(card.createdAt)}</span>
              </div>
              <CardTile card={card} onOpen={onOpen} variant="stream" tvMode={tvMode} />
            </div>
          ))}
        </section>
      ) : null}
      {cards.map((card) => (
        <div key={card.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--theme-text)]0">
            <span className={`rounded-full px-3 py-1 text-[11px] ${KIND_BADGE[card.kind]}`}>
              {KIND_LABELS[card.kind]}
            </span>
            <span>{formatRelative(card.createdAt)}</span>
          </div>
          <CardTile card={card} onOpen={onOpen} variant="stream" tvMode={tvMode} />
        </div>
      ))}
    </div>
  );
}
