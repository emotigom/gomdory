"use client";

import { useRouter } from "next/navigation";

import type { PythonStudioLiteTeacherSummary as Summary } from "@/lib/lesson-activities/types";

type Props = {
  summary: Summary | null;
  lessonTitle?: string | null;
  studentUrl?: string | null;
};

function formatTime(value: string | null): string {
  if (!value) return "시간 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PythonStudioLiteTeacherSummary({ summary, lessonTitle, studentUrl }: Props) {
  const router = useRouter();
  if (!summary) return null;

  return (
    <section data-testid="python-studio-lite-teacher-summary" className="hud-card-shell rounded-2xl border border-violet-300/20 bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[0_18px_48px_rgba(8,47,73,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">Live activity</p>
          {lessonTitle ? <p className="mt-1 truncate text-[11px] font-bold text-[var(--theme-text-muted)]">{lessonTitle}</p> : null}
          <h3 className="mt-1 text-base font-black text-[var(--theme-text)]">{summary.activityTitle}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">학생별 저장/제출 상태만 간단히 봅니다. 오른쪽 요약에는 전체 코드를 노출하지 않습니다.</p>
        </div>
        <button type="button" onClick={() => router.refresh()} className="shrink-0 rounded-xl border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs font-bold text-violet-50 hover:bg-violet-300/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-100">
          새로고침
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-2">
          <dt className="text-[var(--theme-text-subtle)]">참여 학생 수</dt>
          <dd className="mt-1 text-lg font-black text-[var(--theme-text)]">{summary.participantCount}</dd>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2">
          <dt className="text-[var(--theme-text-muted)]/70">저장 수</dt>
          <dd className="mt-1 text-lg font-black text-[var(--theme-text)]">{summary.savedCount}</dd>
        </div>
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-2">
          <dt className="text-emerald-100/70">제출 수</dt>
          <dd className="mt-1 text-lg font-black text-emerald-100">{summary.submittedCount}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3">
        <p className="text-xs font-bold text-[var(--theme-text)]">최근 제출</p>
        {summary.recentSubmissions.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-[var(--theme-text-subtle)]">아직 저장하거나 제출한 학생이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {summary.recentSubmissions.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-2">
                <span className="min-w-0 truncate text-[11px] font-bold text-violet-100">{item.displayName || "익명 학생"}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${item.status === "submitted" ? "border-emerald-200/40 bg-emerald-300/15 text-emerald-100" : "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)]"}`}>
                  {item.status === "submitted" ? "제출됨" : "저장됨"} · {formatTime(item.submittedAt ?? item.savedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {studentUrl ? <a href={studentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-violet-950 hover:bg-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">학생 화면 열기</a> : null}
    </section>
  );
}
