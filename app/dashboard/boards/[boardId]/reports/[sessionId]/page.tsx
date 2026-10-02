import Link from "next/link";
import { notFound } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import PrintButton from "@/app/_components/PrintButton";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { getSession } from "@/lib/data/sessionsReport";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";
import { buildHighlights } from "@/lib/replay/highlights";
import { buildReportInsights } from "@/lib/data/sessionsReportInsights";
import type { SessionReport } from "@/lib/types/sessionReport";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReportShareControls from "../ReportShareControls";

const eventLabelMap: Record<string, string> = {
  session_started: "기록 시작",
  session_ended: "기록 종료",
  step_changed: "스텝 변경",
  qa_window_changed: "Q&A 변경",
  question_pinned: "질문 고정",
  poll_opened: "투표 시작",
  poll_closed: "투표 종료",
  pulse_reset: "이해도 초기화",
  nudge_sent: "출석 알림",
  snapshot: "스냅샷",
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default async function SessionReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; sessionId: string }>;
  searchParams?: Promise<{ print?: string }>;
}) {
  const { boardId, sessionId } = await params;
  await requireUser(`/dashboard/boards/${boardId}`);
  const query = await searchParams;
  const printMode = query?.print === "1";

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return notFound();
  }

  const { session, events } = await getSession({ boardId, sessionId });
  if (!session) {
    return notFound();
  }

  const report = session.report as SessionReport | null;
  const highlights = report?.highlights ?? [];
  const topHighlights = highlights.slice(0, 3);
  const durationSeconds = report?.durationSeconds ?? 0;
  const insights = buildReportInsights(report, events);
  const timeline = events
    .filter((event) => event.type !== "snapshot")
    .map((event) => {
      const stepLabel =
        event.type === "step_changed" && typeof event.payload?.label === "string"
          ? `스텝 변경 · ${event.payload.label}`
          : null;
      return {
        id: event.id,
        label: stepLabel ?? eventLabelMap[event.type] ?? event.type,
        ts: event.ts,
      };
    });
  const replayHighlights = buildHighlights(
    events.map((event) => ({ ts: event.ts, type: event.type, payload: event.payload ?? {} })),
  );
  const quickClipHighlight = replayHighlights
    .slice()
    .sort((a, b) => b.severity - a.severity || b.ts - a.ts)[0];
  const quickClipQuery = quickClipHighlight ? `?clip=highlight&ts=${quickClipHighlight.ts}` : "";
  const quickClipHref = `/dashboard/boards/${boardId}/replay/${sessionId}${quickClipQuery}`;

  return (
    <div data-print-mode={printMode ? "true" : "false"} className="space-y-6">
      <PageMarker page="dashboard" view="reports" extra={{ report: "session" }} />
      <div data-page-marker="dashboard_report" className="sr-only" />
      {printMode ? <div data-page-marker="dashboard_report_print" className="sr-only" /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Report v2</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{report?.title ?? "수업 리포트"}</h1>
          <p className="text-sm text-gray-600">
            {new Date(session.started_at).toLocaleString("ko-KR")}
            {session.ended_at ? ` ~ ${new Date(session.ended_at).toLocaleString("ko-KR")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton
            printHref={`/dashboard/boards/${boardId}/reports/${sessionId}?print=1`}
            backHref={`/dashboard/boards/${boardId}/reports/${sessionId}`}
            isPrintMode={printMode}
          />
          <Link
            href={`/dashboard/boards/${boardId}/replay/${sessionId}`}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            리플레이 보기
          </Link>
          <Link
            href={boardHubHref(boardId)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            보드로 돌아가기
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">공유 가능한 리포트</p>
            <p className="mt-2 text-sm text-slate-600">로그인 없이 열리는 읽기 전용 링크를 공유하세요.</p>
          </div>
          <div className={printMode ? "print-hidden" : ""}>
            <ReportShareControls boardId={boardId} sessionId={sessionId} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4 print-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Replay v2 · Clips</p>
            <h2 className="mt-2 text-sm font-semibold text-indigo-900">오늘의 하이라이트 3개</h2>
            <ul className="mt-2 space-y-1 text-xs text-indigo-800">
              {topHighlights.length > 0 ? (
                topHighlights.map((highlight) => <li key={highlight}>• {highlight}</li>)
              ) : (
                <li className="text-indigo-700">하이라이트가 아직 없습니다.</li>
              )}
            </ul>
          </div>
          <Link
            href={quickClipHref}
            className="rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            클립 만들기(7일 Safe)
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 print-card">
          <p className="text-xs font-semibold text-indigo-500">참여 피크</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-900">{report?.presence?.peak ?? 0}</p>
          <p className="text-xs text-indigo-700">평균 {report?.presence?.avg ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 print-card">
          <p className="text-xs font-semibold text-slate-500">질문</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{report?.questions?.total ?? 0}</p>
          <p className="text-xs text-slate-600">고정 {report?.questions?.pinned ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 print-card">
          <p className="text-xs font-semibold text-slate-500">투표</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{report?.polls?.length ?? 0}</p>
          <p className="text-xs text-slate-600">응답 {report?.polls?.[0]?.total ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 print-card">
          <p className="text-xs font-semibold text-slate-500">펄스 피크</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{report?.pulse?.peak ?? 0}</p>
          <p className="text-xs text-slate-600">지속 {formatDuration(durationSeconds)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
          <h2 className="text-sm font-semibold text-slate-900">타임라인</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">이벤트 기록이 없습니다.</p>
            ) : (
              timeline.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
                  <span>{entry.label}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(entry.ts).toLocaleTimeString("ko-KR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
          <h2 className="text-sm font-semibold text-slate-900">다음 수업 체크리스트</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {highlights.length > 0 ? (
              highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                  <span>{highlight}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">리포트 하이라이트가 없습니다.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
          <h2 className="text-sm font-semibold text-slate-900">오늘 진행 순서 요약</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {insights.sequenceSummary.length > 0 ? (
              insights.sequenceSummary.map((item) => (
                <p key={item} className="rounded-xl bg-slate-50 px-3 py-2">
                  {item}
                </p>
              ))
            ) : (
              <p className="text-slate-500">진행 순서 데이터가 없습니다.</p>
            )}
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">지연/정체 구간</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {insights.bottlenecks.length > 0 ? (
              insights.bottlenecks.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">눈에 띄는 지연 구간이 없습니다.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
          <h2 className="text-sm font-semibold text-slate-900">질문/투표 인사이트</h2>
          <div className="mt-3 space-y-4 text-sm text-slate-700">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">질문이 몰린 단계 Top 3</h3>
              <ul className="mt-2 space-y-2">
                {insights.questionHotspots.length > 0 ? (
                  insights.questionHotspots.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">질문 집중 구간이 없습니다.</li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">투표 응답률이 낮았던 항목</h3>
              <ul className="mt-2 space-y-2">
                {insights.lowPolls.length > 0 ? (
                  insights.lowPolls.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">낮은 응답률 항목이 없습니다.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
        <h2 className="text-sm font-semibold text-slate-900">다음 수업 계획</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {insights.nextPlan.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
