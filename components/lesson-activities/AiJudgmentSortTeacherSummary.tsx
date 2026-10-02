"use client";

import { useRouter } from "next/navigation";

import { AI_JUDGMENT_SORT_CATEGORIES, type JudgmentSortCategoryId } from "@/lib/lesson-activities/aiJudgmentSort";
import type { AiJudgmentSortTeacherSummary as Summary } from "@/lib/lesson-activities/types";

type Props = {
  summary: Summary | null;
  lessonTitle?: string | null;
  studentUrl: string | null;
};

const categoryShortLabels = new Map<JudgmentSortCategoryId, string>(AI_JUDGMENT_SORT_CATEGORIES.map((category) => [category.id, category.shortLabel]));

function truncate(reason: string): string {
  return reason.length > 92 ? `${reason.slice(0, 92)}…` : reason;
}

export default function AiJudgmentSortTeacherSummary({ summary, lessonTitle, studentUrl }: Props) {
  const router = useRouter();
  if (!summary) return null;

  return (
    <section data-testid="ai-judgment-sort-teacher-summary" className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[0_18px_48px_rgba(8,47,73,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-accent)]">Live activity</p>
          {lessonTitle ? <p className="mt-1 truncate text-[11px] font-bold text-[var(--theme-text-muted)]">{lessonTitle}</p> : null}
          <h3 className="mt-1 text-base font-black text-[var(--theme-text)]">{summary.activityTitle}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">카드별 학급 분포와 갈린 의견을 토론에 활용합니다.</p>
        </div>
        <button type="button" onClick={() => router.refresh()} className="shrink-0 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">새로고침</button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-2">
          <dt className="text-[var(--theme-text-subtle)]">참여 학생 수</dt>
          <dd className="mt-1 text-lg font-black text-[var(--theme-text)]">{summary.participantCount}</dd>
        </div>
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-2">
          <dt className="text-emerald-100/70">제출 수</dt>
          <dd className="mt-1 text-lg font-black text-emerald-100">{summary.submittedCount}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3">
        <p className="text-xs font-bold text-[var(--theme-text)]">카드별 분포</p>
        <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
          {summary.cards.map((card) => (
            <li key={card.cardId} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] font-black text-[var(--theme-text-muted)]">{card.title}</p>
                {card.discussionRecommended ? <span className="shrink-0 rounded-full border border-amber-200/40 bg-amber-300/15 px-2 py-0.5 text-[10px] font-black text-amber-100">토론 추천</span> : null}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                {(Object.keys(card.distribution) as JudgmentSortCategoryId[]).map((categoryId) => (
                  <div key={categoryId} className="rounded-md bg-[var(--theme-card-muted)] px-1.5 py-1">
                    <dt className="text-[var(--theme-text-subtle)]">{categoryShortLabels.get(categoryId) ?? categoryId}</dt>
                    <dd className="font-black text-[var(--theme-text)]">{card.distribution[categoryId]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3">
        <p className="text-xs font-bold text-[var(--theme-text)]">최근 이유</p>
        {summary.recentReasons.length === 0 ? <p className="mt-2 text-xs leading-5 text-[var(--theme-text-subtle)]">아직 학생 이유가 없습니다.</p> : (
          <ul className="mt-2 space-y-2">
            {summary.recentReasons.map((item) => (
              <li key={item.id} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-2">
                <p className="text-[11px] font-bold text-[var(--theme-text-muted)]">{item.cardTitle} · {item.categoryLabel} · {item.displayName || "익명 학생"}</p>
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--theme-text)]">{truncate(item.reason)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {studentUrl ? <a href={studentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--theme-accent)] px-3 py-2 text-sm font-black text-[var(--theme-accent-text)] hover:bg-[var(--theme-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">학생 화면 열기</a> : null}
    </section>
  );
}
