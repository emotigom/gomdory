import Link from "next/link";

import { cardClass, focusRingClass, hairlineBorderClass } from "../_components/marketingTokens";

import SiteContentBlocks from "../_components/SiteContentBlocks";
import { getFallbackSiteContent, getMarketingSiteContentMap } from "@/lib/site-content/marketing";

export default async function OperatorPage() {
  const siteContent = await getMarketingSiteContentMap();
  const usageFallback = getFallbackSiteContent("usage");
  const updatesFallback = getFallbackSiteContent("updates");

  return (
    <section className={`${cardClass} space-y-8 p-8 sm:p-12`}>
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">정보</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900">운영자 정보</h1>
        <p className="text-base font-semibold text-slate-800">
          운영자 연락처와 지역을 정돈된 카드로 안내합니다. 문의는 이메일을 권장드립니다.
        </p>
      </div>

      <dl className="grid gap-4 rounded-2xl border border-slate-100 bg-white/80 p-6 sm:grid-cols-2 sm:gap-6 sm:p-8">
        <div className="space-y-1">
          <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">이름</dt>
          <dd className="text-2xl font-semibold text-slate-900">안상균</dd>
        </div>

        <div className="space-y-2">
          <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">이메일</dt>
          <dd className="flex flex-wrap items-center gap-2 text-lg font-semibold text-indigo-800">
            <Link href="mailto:ahnsangkyoon@gmail.com" className={`rounded-full px-3 py-2 ${focusRingClass}`}>
              ahnsangkyoon@gmail.com
            </Link>
            <span aria-hidden className="text-slate-400">
              /
            </span>
            <Link href="mailto:captsk@naver.com" className={`rounded-full px-3 py-2 ${focusRingClass}`}>
              captsk@naver.com
            </Link>
          </dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-100 bg-white/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{siteContent.usage.title}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{siteContent.usage.body || usageFallback.body}</p>
        {siteContent.usage.bodyBlocks.length > 0 ? <div className="mt-4"><SiteContentBlocks blocks={siteContent.usage.bodyBlocks} /></div> : null}
        </article>
        <article className="rounded-2xl border border-slate-100 bg-white/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{siteContent.updates.title}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{siteContent.updates.body || updatesFallback.body}</p>
        {siteContent.updates.bodyBlocks.length > 0 ? <div className="mt-4"><SiteContentBlocks blocks={siteContent.updates.bodyBlocks} /></div> : null}
        </article>
      </div>

      <details className={`${hairlineBorderClass} rounded-2xl bg-slate-50/70 px-6 py-4 text-slate-900`}>
        <summary className={`flex min-h-[44px] items-center justify-between gap-3 text-lg font-semibold text-slate-900 marker:hidden`}>
          연락처 · 지역 확인
          <span aria-hidden>▼</span>
        </summary>
        <div className="mt-4 space-y-3 text-base font-semibold text-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">지역</span>
            <span>대한민국 인천</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">연락처</span>
            <Link href="tel:01048463058" className={`rounded-full px-3 py-1 text-indigo-800 ${focusRingClass}`}>
              010-4846-3058
            </Link>
          </div>
        </div>
      </details>
    </section>
  );
}
