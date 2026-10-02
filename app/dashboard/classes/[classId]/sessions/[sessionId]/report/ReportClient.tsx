"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { pushDashboardToast, useDashboardToasts } from "@/app/dashboard/useDashboardToast";
import type { SessionReportDto } from "@/lib/reports/buildSessionReport";

type ReportClientProps = {
  classId: string;
  sessionId: string;
  report: SessionReportDto;
};

type SaveState = "idle" | "saving";

function formatDateTime(value: string | null) {
  if (!value) return "미정";
  return new Date(value).toLocaleString("ko-KR");
}

function formatDuration(minutes: number, seconds: number) {
  if (minutes > 0) return `${minutes}분`;
  if (seconds > 0) return `${Math.max(1, Math.round(seconds / 60))}분`;
  return "0분";
}

export default function ReportClient({ classId, sessionId, report }: ReportClientProps) {
  const [editMode, setEditMode] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [summary, setSummary] = useState(report.session.summary ?? "");
  const [teacherNotes, setTeacherNotes] = useState(report.session.teacherNotes ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [updatedAt, setUpdatedAt] = useState(report.session.updatedAt ?? null);
  const toasts = useDashboardToasts();

  const hasParticipation =
    report.stats.presencePeak > 0 ||
    report.stats.questionsTotal > 0 ||
    report.stats.pollsCount > 0 ||
    report.stats.pulsePeak > 0;
  const hasPolls = report.polls.length > 0;
  const hasClips = report.clips.length > 0;
  const hasPinnedQuestions = report.pinnedQuestions.length > 0;

  const clipboardText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`[${report.classInfo.title}] 회차 리포트`);
    lines.push(`회차: ${report.session.title}`);
    lines.push(`일시: ${formatDateTime(report.session.startedAt)}${report.session.endedAt ? ` ~ ${formatDateTime(report.session.endedAt)}` : ""}`);
    lines.push(`수업 길이: ${formatDuration(report.session.durationMinutes, report.stats.durationSeconds)}`);
    if (summary.trim()) lines.push(`요약: ${summary.trim()}`);
    if (teacherNotes.trim()) lines.push(`메모: ${teacherNotes.trim()}`);
    if (hasParticipation) {
      lines.push(
        `참여 요약: 피크 ${report.stats.presencePeak}명, 질문 ${report.stats.questionsTotal}건, 투표 ${report.stats.pollsCount}건, 펄스 피크 ${report.stats.pulsePeak}`,
      );
    }
    if (hasPolls) {
      lines.push("투표 요약:");
      report.polls.slice(0, 3).forEach((poll) => {
        lines.push(`- ${poll.title ?? "투표"} (최다: ${poll.topOption ?? "-"})`);
      });
    }
    if (hasClips) {
      lines.push("클립 링크:");
      report.clips.slice(0, 3).forEach((clip) => {
        lines.push(`- ${clip.title ?? "클립"}: ${clip.url}`);
      });
    }
    lines.push(`리플레이: ${report.links.replayUrl}`);
    return lines.join("\n");
  }, [
    report.classInfo.title,
    report.session.title,
    report.session.startedAt,
    report.session.endedAt,
    report.session.durationMinutes,
    report.stats,
    report.polls,
    report.clips,
    report.links.replayUrl,
    summary,
    teacherNotes,
    hasParticipation,
    hasPolls,
    hasClips,
  ]);

  const handleSave = async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    const optimisticAt = new Date().toISOString();
    setUpdatedAt(optimisticAt);

    try {
      const response = await fetch(apiV1Path(`classes/${classId}/sessions/${sessionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, teacherNotes }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data?: { summary?: string | null; teacherNotes?: string | null; updatedAt?: string | null } }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && payload.ok === false && payload.error?.message
            ? payload.error.message
            : "메모를 저장하지 못했습니다.";
        throw new Error(message);
      }
      setSummary(payload?.data?.summary ?? summary);
      setTeacherNotes(payload?.data?.teacherNotes ?? teacherNotes);
      setUpdatedAt(payload?.data?.updatedAt ?? optimisticAt);
      pushDashboardToast({ title: "저장되었습니다.", description: "수업 리포트 메모를 저장했습니다." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "메모를 저장하지 못했습니다.";
      setUpdatedAt(report.session.updatedAt ?? null);
      pushDashboardToast({ title: "저장 실패", description: message });
    } finally {
      setSaveState("idle");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clipboardText);
      pushDashboardToast({ title: "복사 완료", description: "수업일지용 요약을 복사했습니다." });
    } catch {
      pushDashboardToast({ title: "복사 실패", description: "클립보드 접근에 실패했습니다." });
    }
  };

  const toolbar = (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur print:hidden">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">SAFE 모드</span>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={editMode} onChange={() => setEditMode((prev) => !prev)} />
          편집 모드
        </label>
        {editMode ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-rose-600">
            <input type="checkbox" checked={detailMode} onChange={() => setDetailMode((prev) => !prev)} />
            세부 보기(주의)
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className={buttonTone("secondary", { size: "sm" })}>
          인쇄/PDF
        </button>
        <button type="button" onClick={handleCopy} className={buttonTone("secondary", { size: "sm" })}>
          복사
        </button>
        <Link href={`/dashboard/classes/${classId}`} className={buttonTone("secondary", { size: "sm" })}>
          아카이브로
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }
          .print-hidden {
            display: none !important;
          }
          .report-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-link::after {
            content: " (" attr(href) ")";
            font-size: 10px;
            color: #64748b;
          }
          a {
            color: #0f172a !important;
            text-decoration: none !important;
          }
        }
      `}</style>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 pt-6">
      {toolbar}
      {toasts.length > 0 ? (
        <div className="fixed bottom-6 right-6 z-50 space-y-3 print:hidden">
          {toasts.map((toast) => (
            <div key={toast.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              {toast.description ? <p className="text-xs text-gray-600">{toast.description}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <section className="space-y-2 print:block">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Session Report v1</p>
        <h1 className="text-2xl font-semibold text-slate-900">{report.session.title}</h1>
        <p className="text-sm text-slate-600">
          {report.classInfo.title}
          {report.section ? ` · ${report.section.title}` : ""}
          {` · ${report.board.title}`}
        </p>
        <p className="text-sm text-slate-600">
          {formatDateTime(report.session.startedAt)}
          {report.session.endedAt ? ` ~ ${formatDateTime(report.session.endedAt)}` : ""}
          {` · ${formatDuration(report.session.durationMinutes, report.stats.durationSeconds)}`}
        </p>
        {updatedAt ? <p className="text-xs text-slate-400">마지막 저장 {formatDateTime(updatedAt)}</p> : null}
      </section>

      <section className="report-section rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">요약 & 교사 메모</h2>
            <p className="text-sm text-slate-500">다음 수업 계획과 특이사항을 기록하세요.</p>
          </div>
          {editMode ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className={buttonTone("primary", { size: "sm", tone: "indigo" })}
            >
              {saveState === "saving" ? "저장 중..." : "저장"}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold text-slate-500">간단 요약</p>
            {editMode ? (
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                placeholder="이번 수업의 핵심 내용을 간단히 적어주세요."
              />
            ) : (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {summary.trim() ? summary : "요약이 아직 없습니다."}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold text-slate-500">교사 메모</p>
            {editMode ? (
              <textarea
                value={teacherNotes}
                onChange={(event) => setTeacherNotes(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                placeholder="다음 수업 준비/특이사항을 적어주세요."
              />
            ) : (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {teacherNotes.trim() ? teacherNotes : "메모가 아직 없습니다."}
              </p>
            )}
          </div>
        </div>
      </section>

      {hasParticipation ? (
        <section className="report-section grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4">
            <p className="text-xs font-semibold text-indigo-600">참여 피크</p>
            <p className="mt-2 text-2xl font-semibold text-indigo-900">{report.stats.presencePeak}</p>
            <p className="text-xs text-indigo-700">평균 {report.stats.presenceAvg}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold text-slate-500">질문</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{report.stats.questionsTotal}</p>
            <p className="text-xs text-slate-600">고정 {report.stats.questionsPinned}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold text-slate-500">투표</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{report.stats.pollsCount}</p>
            <p className="text-xs text-slate-600">최근 {report.polls[0]?.total ?? 0}명 참여</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold text-slate-500">펄스 피크</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{report.stats.pulsePeak}</p>
            <p className="text-xs text-slate-600">{formatDuration(report.session.durationMinutes, report.stats.durationSeconds)}</p>
          </div>
        </section>
      ) : null}

      {hasPinnedQuestions || report.stats.questionsPinned > 0 ? (
        <section className="report-section rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">질문/핵심 발언</h2>
              <p className="text-sm text-slate-500">고정된 질문을 기준으로 핵심 발언을 정리합니다.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              고정 {report.stats.questionsPinned}
            </span>
          </div>
          {detailMode && hasPinnedQuestions ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {report.pinnedQuestions.map((question) => (
                <li key={question.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  {question.body}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {detailMode ? "표시할 고정 질문이 없습니다." : "SAFE 모드에서는 질문 내용이 숨겨집니다."}
            </p>
          )}
        </section>
      ) : null}

      {hasPolls ? (
        <section className="report-section rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">투표/펄스 요약</h2>
          <p className="text-sm text-slate-500">최근 투표 결과 요약입니다.</p>
          <div className="mt-4 space-y-3">
            {report.polls.slice(0, 3).map((poll) => (
              <div key={`${poll.title ?? "poll"}-${poll.total}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{poll.title ?? "투표"}</p>
                <p className="text-xs text-slate-600">최다 응답: {poll.topOption ?? "-"}</p>
                <p className="text-xs text-slate-500">응답 수: {poll.total}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="report-section rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">클립/리플레이 링크 허브</h2>
        <p className="text-sm text-slate-500">수업 자료를 공유하거나 아카이브로 남겨두세요.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">클립 목록</p>
            {hasClips ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {report.clips.map((clip) => (
                  <li key={clip.url} className="flex flex-col gap-1">
                    <span>{clip.title ?? "클립"}</span>
                    <a href={clip.url} className="text-xs text-indigo-600 print-link">
                      {clip.url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">아직 생성된 클립이 없어요.</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">리플레이 & 링크</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <a href={report.links.replayUrl} className="text-indigo-600 print-link">
                리플레이 열기
              </a>
              {report.links.hudUrl ? (
                <a href={report.links.hudUrl} className="text-indigo-600 print-link">
                  발표/HUD 링크
                </a>
              ) : null}
              {report.links.studentUrl ? (
                <a href={report.links.studentUrl} className="text-indigo-600 print-link">
                  학생 링크
                </a>
              ) : null}
              {report.links.shareUrl ? (
                <a href={report.links.shareUrl} className="text-indigo-600 print-link">
                  보드 공유 링크
                </a>
              ) : null}
              <Link href={report.links.boardUrl} className={cn("text-indigo-600 print-link", detailMode ? "" : "opacity-80")}>
                보드 관리로 이동
              </Link>
            </div>
          </div>
        </div>
      </section>
      </main>
    </>
  );
}
