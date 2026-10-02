"use client";

import { trackMarketingEvent } from "./marketingAnalytics";
import { premiumFocusRingClass } from "./marketingTokens";

export function MarketingFaqAccordion({
  items,
  location,
}: {
  items: readonly { q: string; a: string }[];
  location: "landing" | "pricing";
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <details
          key={item.q}
          className="marketing-card-emphasis group border border-[color:color-mix(in_oklab,var(--line)_74%,#7dd3fc_26%)] bg-[linear-gradient(165deg,rgba(255,255,255,0.95),rgba(246,241,232,0.92))] p-4 transition duration-300 ease-out open:shadow-[0_26px_100px_-86px_rgba(8,47,73,0.58)]"
          onToggle={(event) => {
            const node = event.currentTarget;
            if (node.open) trackMarketingEvent("faq_expand", { location, faq_id: `${location}_faq_${index + 1}` });
          }}
        >
          <summary className={`flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-sm px-1 text-sm font-semibold text-[var(--ink)] marker:hidden ${premiumFocusRingClass}`}>
            <span>{item.q}</span>
            <span
              aria-hidden
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-xs text-[var(--ink-muted)] transition duration-200 group-open:rotate-45 group-open:border-cyan-300 group-open:text-cyan-700"
            >
              +
            </span>
          </summary>
          <div className="marketing-accordion-answer overflow-hidden">
            <p className="mt-2 px-1 text-sm leading-6 text-[var(--ink-muted)]">{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
