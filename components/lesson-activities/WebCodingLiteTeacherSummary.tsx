"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WebCodingLiteSubmissionGallery from "@/components/lesson-activities/WebCodingLiteSubmissionGallery";
import type { WebCodingLiteTeacherSummary as Summary } from "@/lib/lesson-activities/types";
import { routes } from "@/lib/standards/routes";

type Props = {
  boardId: string;
  summary: Summary | null;
  lessonTitle?: string | null;
  studentUrl: string | null;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WebCodingLiteTeacherSummary({ boardId, summary, lessonTitle, studentUrl }: Props) {
  const router = useRouter();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useState(summary?.hintsEnabled ?? true);
  const [hintSaving, setHintSaving] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);

  useEffect(() => {
    if (summary) setHintsEnabled(summary.hintsEnabled);
  }, [summary]);

  if (!summary) return null;

  const toggleHints = async () => {
    const nextHintsEnabled = !hintsEnabled;
    setHintSaving(true);
    setHintError(null);
    try {
      const response = await fetch(routes.api.boards.webStudioSettings(boardId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hintsEnabled: nextHintsEnabled }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: { hintsEnabled?: boolean }; error?: { message?: string } } | null;
      if (!response.ok || !json?.ok || typeof json.data?.hintsEnabled !== "boolean") {
        throw new Error(json?.error?.message ?? "힌트 설정을 저장하지 못했습니다.");
      }
      setHintsEnabled(json.data.hintsEnabled);
      router.refresh();
    } catch (error) {
      setHintError(error instanceof Error ? error.message : "힌트 설정을 저장하지 못했습니다.");
    } finally {
      setHintSaving(false);
    }
  };

  return (
    <section data-testid="web-coding-lite-teacher-summary" className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[0_18px_48px_rgba(8,47,73,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-accent)]">Live activity</p>
          {lessonTitle ? <p className="mt-1 truncate text-[11px] font-bold text-[var(--theme-text-muted)]">{lessonTitle}</p> : null}
          <h3 className="mt-1 text-base font-black text-[var(--theme-text)]">{summary.activityTitle}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">학생별 저장/제출 상태를 확인하고, 교사 전용 제출물 보기에서 코드를 안전하게 검토합니다.</p>
          <div className="mt-2 rounded-2xl border border-violet-200/25 bg-violet-300/10 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-200/30 bg-violet-300/10 px-2 py-1 text-[11px] font-black text-violet-100">학생 힌트: {hintsEnabled ? "켜짐" : "꺼짐"}</span>
              <button
                type="button"
                onClick={toggleHints}
                disabled={hintSaving}
                className="rounded-full border border-violet-100/35 bg-[var(--theme-card)] px-2.5 py-1 text-[11px] font-black text-violet-50 hover:bg-violet-200/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {hintSaving ? "저장 중..." : hintsEnabled ? "힌트 끄기" : "힌트 켜기"}
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-violet-100/80">{hintsEnabled ? "학생들이 힌트를 볼 수 있어요." : "학생 화면에서 힌트가 숨겨져요."}</p>
            {hintError ? <p role="alert" className="mt-1 text-[11px] leading-4 text-rose-100">{hintError}</p> : null}
          </div>
        </div>
        <button type="button" onClick={() => router.refresh()} className="shrink-0 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">
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
                <span className="min-w-0 truncate text-[11px] font-bold text-[var(--theme-text-muted)]">{item.displayName || "익명 학생"}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${item.status === "submitted" ? "border-emerald-200/40 bg-emerald-300/15 text-emerald-100" : "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)]"}`}>
                  {item.status === "submitted" ? "제출됨" : "저장됨"} · {formatTime(item.submittedAt ?? item.savedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setGalleryOpen(true)} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-emerald-300 px-3 py-2 text-sm font-black text-emerald-950 hover:bg-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">제출물 보기</button>
        {studentUrl ? <a href={studentUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--theme-accent)] px-3 py-2 text-sm font-black text-[var(--theme-accent-text)] hover:bg-[var(--theme-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">학생 화면 열기</a> : null}
      </div>
      <WebCodingLiteSubmissionGallery boardId={boardId} open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </section>
  );
}
