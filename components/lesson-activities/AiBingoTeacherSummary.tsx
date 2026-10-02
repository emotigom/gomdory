"use client";

import { useRouter } from "next/navigation";

import type { AiBingoTeacherSummary as Summary } from "@/lib/lesson-activities/types";

type Props = {
  summary: Summary | null;
  lessonTitle?: string | null;
  studentUrl: string | null;
};

function truncateReason(reason: string): string {
  return reason.length > 96 ? `${reason.slice(0, 96)}…` : reason;
}

export default function AiBingoTeacherSummary({
  summary,
  lessonTitle,
  studentUrl,
}: Props) {
  const router = useRouter();
  if (!summary) return null;

  return (
    <section
      data-testid="ai-bingo-teacher-summary"
      className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[0_18px_48px_rgba(8,47,73,0.22)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-accent)]">
            Live activity
          </p>
          {lessonTitle ? (
            <p className="mt-1 truncate text-[11px] font-bold text-[var(--theme-text-muted)]">
              {lessonTitle}
            </p>
          ) : null}
          <h3 className="mt-1 text-base font-black text-[var(--theme-text)]">
            {summary.activityTitle}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
            학생 선택과 한 줄 이유를 간단히 확인합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="shrink-0 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
        >
          새로고침
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-2">
          <dt className="text-[var(--theme-text-subtle)]">참여 학생 수</dt>
          <dd className="mt-1 text-lg font-black text-[var(--theme-text)]">
            {summary.participantCount}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-2">
          <dt className="text-emerald-100/70">빙고 완성 수</dt>
          <dd className="mt-1 text-lg font-black text-emerald-100">
            {summary.completedCount}
          </dd>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2">
          <dt className="text-[var(--theme-text-muted)]/70">선택된 타일 수</dt>
          <dd className="mt-1 text-lg font-black text-[var(--theme-text)]">
            {summary.selectedTileCount}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3">
        <p className="text-xs font-bold text-[var(--theme-text)]">최근 이유</p>
        {summary.recentReasons.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-[var(--theme-text-subtle)]">
            아직 학생 이유가 없습니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {summary.recentReasons.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-2"
              >
                <p className="text-[11px] font-bold text-[var(--theme-text-muted)]">
                  {item.tileLabel} · {item.displayName || "익명 학생"}
                </p>
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--theme-text)]">
                  {truncateReason(item.reason)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {studentUrl ? (
        <a
          href={studentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--theme-accent)] px-3 py-2 text-sm font-black text-[var(--theme-accent-text)] hover:bg-[var(--theme-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
        >
          학생 화면 열기
        </a>
      ) : null}
    </section>
  );
}
