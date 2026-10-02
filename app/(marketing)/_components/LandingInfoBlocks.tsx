import Link from "next/link";

import { getCurrentUserOpsAdmin } from "@/lib/auth/getCurrentUserOpsAdmin";
import { makeExcerpt } from "@/lib/site-content/excerpt";
import { getFallbackSiteContent } from "@/lib/site-content/marketing";
import { getSiteContentByKey } from "@/lib/site-content/server";

type InfoCard = {
  key: "community_usage" | "community_updates";
  title: string;
  body: string;
  href: string;
  label: string;
};

export default async function LandingInfoBlocks() {
  const isOpsAdmin = await getCurrentUserOpsAdmin();
  const [usage, updates] = await Promise.all([
    getSiteContentByKey("community_usage").catch(() => null),
    getSiteContentByKey("community_updates").catch(() => null),
  ]);

  const cards: InfoCard[] = [
    {
      key: "community_usage",
      title: usage?.title?.trim() || getFallbackSiteContent("community_usage").title,
      body: makeExcerpt(usage?.body || getFallbackSiteContent("community_usage").body),
      href: "/community?tab=usage",
      label: "도입 가이드",
    },
    {
      key: "community_updates",
      title: updates?.title?.trim() || getFallbackSiteContent("community_updates").title,
      body: makeExcerpt(updates?.body || getFallbackSiteContent("community_updates").body),
      href: "/community?tab=updates",
      label: "업데이트",
    },
  ];

  return (
    <section className="marketing-info-section space-y-6 border-t pt-9" aria-label="도입/운영 리소스" data-testid="landing-info-secondary">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--marketing-text-subtle,var(--marketing-text-muted))]">Resources</p>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--marketing-text)]">도입 이후 바로 쓰는 운영 리소스</h2>
        </div>
        <Link href="/community" className="marketing-info-utility-link text-xs font-semibold uppercase tracking-[0.12em]">
          커뮤니티 전체 보기
        </Link>
      </div>

      <div className="grid gap-4">
        {cards.map((card) => (
          <article key={card.key} className="grid gap-2.5 border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0 md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-start md:gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--marketing-text-subtle,var(--marketing-text-muted))]">{card.label}</p>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold leading-6 text-[var(--marketing-text)]">{card.title}</h3>
              <p className="line-clamp-2 max-w-[60ch] whitespace-pre-line text-sm leading-6 text-[var(--marketing-text-subtle,var(--marketing-text-muted))]">{card.body}</p>
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <Link href={card.href} className="marketing-info-more-button inline-flex min-h-8 items-center border px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] transition">
                더보기
              </Link>
              {isOpsAdmin ? (
                <Link
                  href={`/dashboard/ops/site-content?key=${card.key}`}
                  className="marketing-info-utility-link inline-flex min-h-8 items-center px-1 text-[10px] font-semibold tracking-[0.08em] underline-offset-2 hover:underline"
                >
                  ✎ 편집
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
