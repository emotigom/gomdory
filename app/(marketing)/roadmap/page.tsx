import type { Metadata } from "next";

import SiteContentBlocks from "../_components/SiteContentBlocks";
import { getFallbackSiteContent, getMarketingSiteContentMap } from "@/lib/site-content/marketing";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Operator-first roadmap across classroom boards, EDU labs, community, and VR.",
};

const roadmapSections = [
  {
    title: "Now",
    items: [
      "Board flow defaults that reduce setup time before class starts.",
      "Faster triage actions for operators handling live board requests.",
      "EDU lab pilots focused on attendance, recap, and grading handoff.",
    ],
  },
  {
    title: "Next",
    items: [
      "Board templates tuned for operator teams running multiple classes.",
      "Community launch packs for onboarding new teachers and moderators.",
      "EDU labs for scenario rehearsals and classroom failover drills.",
    ],
  },
  {
    title: "Later",
    items: [
      "VR room companion for wall review, presentation cues, and playback.",
      "Community-powered extension marketplace with curation boundaries.",
      "Operator control center for multi-board policy and incident visibility.",
    ],
  },
];

export default async function MarketingRoadmapPage() {
  const siteContent = await getMarketingSiteContentMap();
  const fallback = getFallbackSiteContent("roadmap");
  const dynamicBody = siteContent.roadmap.body.trim();

  return (
    <section className="space-y-10 border border-[var(--line)] bg-[var(--bg-ivory)] p-6 sm:p-10">
      <header className="space-y-3 border-b border-[var(--line)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">Roadmap</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">{siteContent.roadmap.title}</h1>
        <p className="max-w-3xl whitespace-pre-wrap text-base text-[var(--ink-muted)]">{dynamicBody || fallback.body}</p>
      </header>

      {siteContent.roadmap.bodyBlocks.length > 0 ? <SiteContentBlocks blocks={siteContent.roadmap.bodyBlocks} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {roadmapSections.map((section) => (
          <article key={section.title} className="space-y-4 border border-[var(--line)] bg-[var(--bg-cream)] p-5">
            <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">{section.title}</h2>
            <ul className="space-y-3 text-sm leading-6 text-[var(--ink-muted)]">
              {section.items.map((item) => (
                <li key={item} className="border-l-2 border-[var(--line)] pl-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
