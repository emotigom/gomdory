"use client";

import Link from "next/link";
import { useMemo } from "react";

import { cn, pill } from "@/app/_components/uiTokens";
import { formatPct } from "@/lib/format/bytes";
import { useStorageUsage } from "@/lib/hooks/useStorageUsage";
import { calculateUsagePercent, getUsageTier } from "@/lib/storage/usage";

type ThresholdState =
  | { tone: "warn" | "danger"; label: string; usedPct: number }
  | { tone: "ok"; label: string; usedPct: number }
  | { tone: "loading" | "error"; usedPct?: number; label?: string };

function toneStyles(tone: ThresholdState["tone"]) {
  switch (tone) {
    case "danger":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    case "warn":
      return "bg-amber-50 text-amber-700 ring-amber-100";
    case "ok":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "loading":
    case "error":
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function StorageThresholdBadge() {
  const { latest, quotaBytes, loading, error } = useStorageUsage();
  const usedBytes = (latest?.r2Bytes ?? 0) + (latest?.dbBytes ?? 0);
  const usedPct = useMemo(
    () => calculateUsagePercent(usedBytes, quotaBytes),
    [quotaBytes, usedBytes],
  );
  const state: ThresholdState = useMemo(() => {
    if (loading && !latest) return { tone: "loading" };
    if (error && !latest) return { tone: "error" };

    const tier = getUsageTier(usedPct);
    if (tier === "danger") {
      return { tone: "danger", label: "용량 부족", usedPct };
    }
    if (tier === "warn") {
      return { tone: "warn", label: "용량 주의", usedPct };
    }
    return { tone: "ok", label: "여유", usedPct };
  }, [error, loading, latest, usedPct]);

  const metaText =
    state.tone === "warn" || state.tone === "danger"
      ? "최적화/중복제거로 절감 가능"
      : "정기적으로 사용량을 확인하세요";

  const pctSource =
    state.tone === "warn" || state.tone === "danger" || state.tone === "ok" ? state.usedPct : null;
  const pctLabel = pctSource === null ? "" : formatPct(pctSource);
  const label =
    state.tone === "loading"
      ? "용량 불러오는 중"
      : state.tone === "error"
        ? "용량 확인 실패"
        : state.label;

  return (
    <Link
      href="/dashboard/storage"
      data-interactive="true"
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ring-1 transition hover:translate-y-[1px]",
        toneStyles(state.tone),
      )}
      title={state.tone === "error" ? "저장소 정보를 불러오지 못했습니다." : metaText}
    >
      <span className={cn(pill.badge, "text-xs font-bold", toneStyles(state.tone))}>{label}</span>
      {pctLabel ? <span className="text-xs font-semibold text-slate-600">{pctLabel}</span> : null}
      <span className="text-[11px] font-semibold text-slate-500">{metaText}</span>
    </Link>
  );
}
