"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useIsDashboardRoute } from "@/app/dashboard/useIsDashboardRoute";
import { formatPct } from "@/lib/format/bytes";
import { useStorageUsage } from "@/lib/hooks/useStorageUsage";
import { calculateUsagePercent, getUsageTier } from "@/lib/storage/usage";

export type StorageUsageBadgeState = {
  tone: "ok" | "warn" | "danger" | "loading" | "error";
  label: string;
  usedPct?: number;
};

export function resolveStorageUsageBadge(usedPct: number): StorageUsageBadgeState {
  const tier = getUsageTier(usedPct);
  if (tier === "danger") {
    return { tone: "danger", label: "저장공간 부족", usedPct };
  }
  if (tier === "warn") {
    return { tone: "warn", label: `저장공간 ${formatPct(usedPct, 0)}`, usedPct };
  }
  return { tone: "ok", label: "저장공간 정상", usedPct };
}

function toneStyles(tone: StorageUsageBadgeState["tone"]) {
  switch (tone) {
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "loading":
    case "error":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function StorageUsageBadge() {
  const isDashboard = useIsDashboardRoute();
  const { latest, quotaBytes, loading, error } = useStorageUsage({ enabled: isDashboard });
  const usedBytes = (latest?.r2Bytes ?? 0) + (latest?.dbBytes ?? 0);
  const usedPct = useMemo(
    () => calculateUsagePercent(usedBytes, quotaBytes),
    [quotaBytes, usedBytes],
  );
  const state: StorageUsageBadgeState = useMemo(() => {
    if (!isDashboard) {
      return { tone: "loading", label: "저장공간 확인 중" };
    }
    if (loading && !latest) {
      return { tone: "loading", label: "저장공간 확인 중" };
    }
    if (error && !latest) {
      return { tone: "error", label: "저장공간 확인 실패" };
    }
    return resolveStorageUsageBadge(usedPct);
  }, [error, isDashboard, loading, latest, usedPct]);

  if (!isDashboard) {
    return null;
  }

  return (
    <Link
      href="/dashboard/storage"
      className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:translate-y-[1px] ${toneStyles(state.tone)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>{state.label}</span>
        {typeof state.usedPct === "number" ? (
          <span className="text-[11px] font-semibold text-slate-500">{formatPct(state.usedPct, 0)}</span>
        ) : null}
      </div>
    </Link>
  );
}
