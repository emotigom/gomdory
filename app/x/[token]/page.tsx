import { notFound } from "next/navigation";

import { getRequestOrigin } from "@/lib/http/requestHost";
import { apiV1Path } from "@/lib/standards/pathTypes";
import type { ShowcaseSnapshot } from "@/lib/showcase/buildShowcaseSnapshot";

export const metadata = {
  title: "Showcase",
  robots: {
    index: false,
    follow: false,
  },
};

type ShowcaseSnapshotResponse = ShowcaseSnapshot;

function formatCount(value?: number | null) {
  if (value === null || value === undefined) return "–";
  return value.toLocaleString("ko-KR");
}

function formatAverage(value?: number | null) {
  if (value === null || value === undefined) return "–";
  return value.toFixed(1);
}

export default async function PublicShowcasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}${apiV1Path(`public/showcases/${token}`)}`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    notFound();
  }

  const snapshot = (await response.json()) as ShowcaseSnapshotResponse;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12" data-page-marker="showcase-public">
      <header className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-6 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-500">수업 전시 모드</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 md:text-5xl">{snapshot.headline}</h1>
        <p className="mt-4 text-sm text-slate-600 md:text-base">
          수업 종료 후 자동으로 생성된 결과 요약입니다. 학생 원본 데이터는 포함되지 않습니다.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">참여자</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatCount(snapshot.metrics.participants)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">질문 수</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatCount(snapshot.metrics.questionsCount)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">도움 요청</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatCount(snapshot.metrics.helpRequests)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">투표 수</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {formatCount(snapshot.metrics.pollsCount)}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Highlights</h2>
          <span className="text-xs text-slate-500">집계/요약 정보만 노출됩니다.</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {snapshot.highlights.length > 0 ? (
            snapshot.highlights.map((highlight, index) => {
              if (highlight.kind === "poll") {
                return (
                  <article
                    key={`${highlight.kind}-${index}`}
                    className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">투표</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">{highlight.title}</h3>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {highlight.topOptions.map((option) => (
                        <li key={`${option.label}-${option.count}`} className="flex items-center justify-between">
                          <span>{option.label}</span>
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                            {formatCount(option.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              }

              return (
                <article
                  key={`${highlight.kind}-${index}`}
                  className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-500">{highlight.label}</p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">평균 지수</h3>
                  <p className="mt-4 text-4xl font-semibold text-slate-900">{formatAverage(highlight.valueAvg)}</p>
                  <p className="mt-2 text-xs text-slate-500">5점 만점 기준</p>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              아직 공유할 하이라이트가 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Gallery</h2>
          <span className="text-xs text-slate-500">클립/보드 썸네일을 모아 보여줍니다.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.gallery.length > 0 ? (
            snapshot.gallery.map((item, index) => (
              <article
                key={`${item.caption}-${index}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {item.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbUrl} alt={item.caption} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 text-xs font-semibold text-slate-500">
                    안전한 썸네일 준비 중
                  </div>
                )}
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{item.caption}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              공유할 갤러리 콘텐츠가 없습니다.
            </div>
          )}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-6 text-center">
        <p className="text-xs text-slate-400">생성 시각: {new Date(snapshot.generatedAt).toLocaleString("ko-KR")}</p>
        <a
          href="https://www.gomdory.com"
          className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          rel="noreferrer"
          target="_blank"
        >
          Gomdory로 내 수업 만들기
        </a>
      </footer>
    </main>
  );
}
