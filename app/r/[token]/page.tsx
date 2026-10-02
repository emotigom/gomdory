import { headers } from "next/headers";
import { notFound } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import PrintButton from "@/app/_components/PrintButton";
import { buildReportInsights } from "@/lib/data/sessionsReportInsights";
import { getHostFromHeaders } from "@/lib/routing/host";
import { apiV1Path } from "@/lib/standards/pathTypes";
import type { SessionReport } from "@/lib/types/sessionReport";

type PublicReportPayload = {
  title: string;
  startedAt: string;
  endedAt: string | null;
  report: SessionReport | null;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default async function PublicReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ print?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const printMode = query?.print === "1";

  const headerList = await headers();
  const host = getHostFromHeaders(headerList);
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${protocol}://${host}` : null;

  const response = baseUrl
    ? await fetch(`${baseUrl}${apiV1Path(`r/${token}`)}`, {
        cache: "no-store",
      }).catch(() => null)
    : null;

  if (!response || !response.ok) {
    return notFound();
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: PublicReportPayload }
    | { ok?: false; error?: { message?: string } }
    | null;

  if (!payload || payload.ok !== true) {
    return notFound();
  }

  const data = payload.data;
  const report = data.report;
  const insights = buildReportInsights(report);

  return (
    <div
      data-print-mode={printMode ? "true" : "false"}
      data-page-marker="public-session-report"
      className={printMode ? "min-h-screen bg-white" : "min-h-screen bg-gradient-to-br from-white via-indigo-50/40 to-slate-100"}
    >
      <PageMarker page="public" view="report" />
      <div data-page-marker="public_report" className="sr-only" />
      {printMode ? <div data-page-marker="public_report_print" className="sr-only" /> : null}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-10 print:hidden"
      >
        <div className="select-none text-5xl font-black uppercase tracking-[0.3em] text-indigo-300 md:text-7xl">
          CONFIDENTIAL • Gomdory
        </div>
      </div>
      <main className={printMode ? "relative z-10 mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10" : "relative z-10 mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16"}>
        <header className="rounded-3xl border border-indigo-100 bg-white/80 p-8 shadow-[0_20px_60px_-40px_rgba(79,70,229,0.5)] print-card">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Read-only Session Report</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900 md:text-4xl">{data.title}</h1>
          <p className="mt-3 text-base text-slate-600 md:text-lg">
            {new Date(data.startedAt).toLocaleString("ko-KR")}
            {data.endedAt ? ` ~ ${new Date(data.endedAt).toLocaleString("ko-KR")}` : ""}
          </p>
          <p className="mt-4 inline-flex items-center rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 print-hidden">
            읽기 전용 수업 리포트
          </p>
          <div className="mt-4">
            <PrintButton printHref={`/r/${token}?print=1`} backHref={`/r/${token}`} isPrintMode={printMode} />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print-card">
            <h2 className="text-lg font-semibold text-slate-900">핵심 요약</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 print-card">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">참여 피크</p>
                <p className="mt-2 text-3xl font-semibold text-indigo-900">{report?.presence?.peak ?? 0}</p>
                <p className="text-sm text-indigo-700">평균 {report?.presence?.avg ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 print-card">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">질문</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{report?.questions?.total ?? 0}</p>
                <p className="text-sm text-slate-600">고정 {report?.questions?.pinned ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">투표</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{report?.polls?.length ?? 0}</p>
                <p className="text-sm text-slate-600">최다 응답 {report?.polls?.[0]?.topOption ?? "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 print-card">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">펄스 피크</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{report?.pulse?.peak ?? 0}</p>
                <p className="text-sm text-slate-600">지속 {formatDuration(report?.durationSeconds ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print-card">
            <h2 className="text-lg font-semibold text-slate-900">하이라이트</h2>
            <div className="mt-6 space-y-3 text-base text-slate-700">
              {report?.highlights && report.highlights.length > 0 ? (
                report.highlights.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 print-card">
                    <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                    <span className="text-lg text-slate-800">{item}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-500 print-card">
                  공유된 하이라이트가 없습니다.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print-card">
          <h2 className="text-lg font-semibold text-slate-900">투표 요약</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {report?.polls && report.polls.length > 0 ? (
              report.polls.map((poll, index) => {
                const pollKey = typeof poll.pollId === "string" ? poll.pollId : `${index}`;
                const pollTitle = typeof poll.title === "string" ? poll.title : "투표";
                return (
                  <div key={pollKey} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 print-card">
                    <p className="text-sm font-semibold text-slate-900">{pollTitle}</p>
                    <p className="mt-2 text-sm text-slate-600">최다 선택: {poll.topOption ?? "-"}</p>
                    <p className="text-sm text-slate-600">참여 {poll.total ?? 0}명</p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">공유된 투표 요약이 없습니다.</p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print-card">
            <h2 className="text-lg font-semibold text-slate-900">오늘 진행 순서 요약</h2>
            <div className="mt-4 space-y-2 text-base text-slate-700">
              {insights.sequenceSummary.length > 0 ? (
                insights.sequenceSummary.map((item) => (
                  <p key={item} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 print-card">
                    {item}
                  </p>
                ))
              ) : (
                <p className="text-slate-500">진행 순서 데이터가 없습니다.</p>
              )}
            </div>
            <h3 className="mt-6 text-base font-semibold text-slate-900">지연/정체 구간</h3>
            <ul className="mt-3 space-y-2 text-base text-slate-700">
              {insights.bottlenecks.length > 0 ? (
                insights.bottlenecks.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">눈에 띄는 지연 구간이 없습니다.</li>
              )}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print-card">
            <h2 className="text-lg font-semibold text-slate-900">다음 수업 계획</h2>
            <ul className="mt-4 space-y-2 text-base text-slate-700">
              {insights.nextPlan.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm print-card">
          학생 개인정보가 포함되지 않은 요약본입니다. 무단 재배포를 금지합니다.
        </footer>
      </main>
    </div>
  );
}
