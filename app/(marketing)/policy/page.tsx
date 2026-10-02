import type { Metadata } from "next";

import SiteContentBlocks from "../_components/SiteContentBlocks";
import { getFallbackSiteContent, getMarketingSiteContentMap } from "@/lib/site-content/marketing";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | 곰도리에듀",
  description: "곰도리에듀의 개인정보 보호 원칙, 접근통제, 운영 보안 기준과 교사 주도 수업 데이터 처리 방침을 안내합니다.",
  alternates: { canonical: "/policy" },
};

const principles = [
  {
    title: "No PII in analytics",
    detail:
      "Analytics events are scoped to product behavior and performance. Personal identifiers are excluded by policy and implementation review.",
  },
  {
    title: "RLS boundaries stay explicit",
    detail:
      "Row Level Security is the default boundary for board, class, and operator data. Access paths are reviewed against least-privilege roles.",
  },
  {
    title: "Service-role only tables",
    detail:
      "Sensitive operational tables are isolated for service-role access only. Client sessions never receive direct write access to those tables.",
  },
];

export default async function MarketingPolicyPage() {
  const siteContent = await getMarketingSiteContentMap();
  const fallback = getFallbackSiteContent("policy");
  const dynamicBody = siteContent.policy.body.trim();

  return (
    <section className="space-y-10 border border-[var(--line)] bg-[var(--bg-ivory)] p-6 sm:p-10">
      <header className="space-y-3 border-b border-[var(--line)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">Policy</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">{siteContent.policy.title}</h1>
        <p className="max-w-3xl whitespace-pre-wrap text-base text-[var(--ink-muted)]">{dynamicBody || fallback.body}</p>
      </header>

      {siteContent.policy.bodyBlocks.length > 0 ? <SiteContentBlocks blocks={siteContent.policy.bodyBlocks} /> : null}

      <div className="space-y-4">
        {principles.map((principle) => (
          <article key={principle.title} className="space-y-3 border border-[var(--line)] bg-[var(--bg-cream)] p-5">
            <h2 className="text-lg font-semibold text-[var(--ink)]">{principle.title}</h2>
            <p className="text-sm leading-6 text-[var(--ink-muted)]">{principle.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
