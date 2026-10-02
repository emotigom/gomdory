"use client";

import Link from "next/link";
import { useEffect } from "react";

import { type MarketingFunnelEventName, trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";

type MarketingEventName = MarketingFunnelEventName;

export function trackMarketingEvent(name: MarketingEventName, meta?: Record<string, string | number | boolean>) {
  trackMarketingFunnelEvent(name, meta);
}

export function MarketingViewTracker({ eventName }: { eventName: Extract<MarketingEventName, "landing_view" | "pricing_view"> }) {
  useEffect(() => {
    trackMarketingEvent(eventName);
  }, [eventName]);

  return null;
}

export function MarketingTrackedLink({
  href,
  eventName,
  className,
  children,
  meta,
  eventOnClick = true,
  testId,
}: {
  href: string;
  eventName: MarketingEventName;
  className: string;
  children: React.ReactNode;
  meta?: Record<string, string | number | boolean>;
  eventOnClick?: boolean;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      data-testid={testId}
      onClick={() => {
        if (!eventOnClick) return;
        trackMarketingEvent(eventName, { destination: href, ...meta });
      }}
    >
      {children}
    </Link>
  );
}
