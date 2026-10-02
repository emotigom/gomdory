"use client";

import { useEffect, useState } from "react";
import { getNetworkSaverMetricsSnapshot } from "@/lib/edu/netsaver/metrics";

export default function RampupWaitIndicator() {
  const [waitUntil, setWaitUntil] = useState<number | null>(
    getNetworkSaverMetricsSnapshot().rampup.waitActiveUntil,
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWaitUntil(getNetworkSaverMetricsSnapshot().rampup.waitActiveUntil);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!waitUntil || waitUntil <= Date.now()) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
      준비 중…
    </div>
  );
}
