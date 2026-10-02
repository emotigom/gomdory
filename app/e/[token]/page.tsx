import { notFound } from "next/navigation";

import { GalleryCard } from "@/app/dashboard/gallery/_components/GalleryCard";
import { getRequestOrigin } from "@/lib/http/requestHost";
import { apiV1Path } from "@/lib/standards/pathTypes";
import type { ExhibitHighlightKind, ExhibitPayload } from "@/lib/exhibit/types";

export const metadata = {
  title: "Exhibit",
  robots: {
    index: false,
    follow: false,
  },
};

type ExhibitTheme = {
  badge: string;
  coverMark: string;
  coverTone: "accent" | "success" | "warning" | "ink";
};

const HIGHLIGHT_THEMES: Record<ExhibitHighlightKind, ExhibitTheme> = {
  question: {
    badge: "Question",
    coverMark: "❓",
    coverTone: "accent",
  },
  idea: {
    badge: "Idea",
    coverMark: "💡",
    coverTone: "success",
  },
  result: {
    badge: "Result",
    coverMark: "✅",
    coverTone: "warning",
  },
  photo_placeholder: {
    badge: "Photo",
    coverMark: "📷",
    coverTone: "ink",
  },
};

function formatCount(value?: number | null) {
  if (value === null || value === undefined) return "–";
  return value.toLocaleString("ko-KR");
}

export default async function ExhibitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}${apiV1Path(`public/exhibits/${token}`)}`, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    notFound();
  }

  const payload = (await response.json()) as ExhibitPayload;
  const generatedAt = new Date(payload.generatedAt).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-6 py-12" data-page-marker="exhibit">
      <header className="space-y-4 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-6 py-8 shadow-sm">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          수업 결과 전시
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">{payload.board.title}</h1>
        <p className="text-sm text-slate-600">
          학생 정보 없이 요약된 하이라이트와 익명 집계를 확인하세요.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">카드</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCount(payload.board.counts.cards)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">컬럼</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCount(payload.board.counts.columns)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">질문</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatCount(payload.aggregates.questionsCount)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">도움 요청</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatCount(payload.aggregates.helpCount)}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">하이라이트 갤러리</h2>
            <p className="text-xs text-slate-500">선별된 카드만 안전하게 요약됩니다.</p>
          </div>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {payload.board.layout === "columns" ? "Columns" : "Gallery"} layout
          </span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {payload.highlights.length > 0 ? (
            payload.highlights.map((highlight, index) => {
              const theme = HIGHLIGHT_THEMES[highlight.kind];
              return (
                <GalleryCard
                  key={`${highlight.textPreview}-${index}`}
                  title={highlight.title ?? "카드 하이라이트"}
                  description={highlight.textPreview}
                  subtitle={highlight.score ? `추천 점수 ${highlight.score}` : undefined}
                  badge={theme.badge}
                  coverMark={theme.coverMark}
                  coverLabel={theme.badge}
                  coverTone={theme.coverTone}
                  actions={[]}
                  tileIndex={index}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              아직 전시에 포함할 하이라이트가 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">익명 집계 요약</h2>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>질문 누적</span>
              <span className="font-semibold text-slate-900">
                {formatCount(payload.aggregates.questionsCount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>도움 요청 누적</span>
              <span className="font-semibold text-slate-900">
                {formatCount(payload.aggregates.helpCount)}
              </span>
            </div>
            {payload.aggregates.votesSummary ? (
              <div className="flex items-center justify-between">
                <span>투표 참여</span>
                <span className="font-semibold text-slate-900">
                  {formatCount(payload.aggregates.votesSummary.responsesCount)}{" "}
                  <span className="text-xs text-slate-500">({payload.aggregates.votesSummary.pollsCount}건)</span>
                </span>
              </div>
            ) : null}
            {payload.aggregates.pulseSummary ? (
              <div className="flex items-center justify-between">
                <span>반응</span>
                <span className="font-semibold text-slate-900">
                  {formatCount(payload.aggregates.pulseSummary.total)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">타임라인 요약</h2>
          <div className="space-y-2 text-sm text-slate-600">
            {payload.timeline.length > 0 ? (
              payload.timeline.map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="flex items-center justify-between">
                  <span>{entry.label}</span>
                  <span className="font-semibold text-slate-900">{formatCount(entry.count)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">표시할 익명 집계가 없습니다.</p>
            )}
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span>{generatedAt}</span>
        <a
          href="https://www.gomdory.com"
          className="font-semibold text-slate-500 hover:text-indigo-500"
          rel="noreferrer"
          target="_blank"
        >
          Gomdory로 수업 보드 만들기
        </a>
      </footer>
    </main>
  );
}
