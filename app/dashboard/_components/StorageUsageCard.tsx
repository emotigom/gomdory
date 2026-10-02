"use client";

import Link from "next/link";
import { useMemo } from "react";

import { cn } from "@/app/_components/uiTokens";
import { formatBytes, formatPct } from "@/lib/format/bytes";
import { useStorageUsage } from "@/lib/hooks/useStorageUsage";
import { useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";
import { calculateUsagePercent, getUsageTier } from "@/lib/storage/usage";

type BadgeTone = "calm" | "warn" | "danger";

const badgeStyles: Record<BadgeTone, string> = {
  calm: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

const sparklineStroke: Record<BadgeTone, string> = {
  calm: "stroke-emerald-500",
  warn: "stroke-amber-500",
  danger: "stroke-rose-500",
};

export default function StorageUsageCard() {
  const { latest, trend, loading, error, refresh, quotaBytes } = useStorageUsage();

  const resolvedLatest =
    latest ??
    ({
      day: new Date().toISOString().slice(0, 10),
      r2Bytes: 0,
      dbBytes: 0,
      filesCount: 0,
      optimizedBytesSaved: 0,
    } as const);

  const usedBytes = resolvedLatest.r2Bytes + resolvedLatest.dbBytes;
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  const usedPct = useMemo(() => calculateUsagePercent(usedBytes, quotaBytes), [quotaBytes, usedBytes]);
  const tier = useMemo(() => getUsageTier(usedPct), [usedPct]);
  const badgeLabel = tier === "danger" ? "경고" : tier === "warn" ? "주의" : "정상";
  const badgeTone: BadgeTone = tier === "danger" ? "danger" : tier === "warn" ? "warn" : "calm";
  const savingsBytes = resolvedLatest.optimizedBytesSaved;

  const chromePrefs = useDashboardChromePrefs();

  const sparklinePoints = useMemo(() => {
    if (!trend || trend.length === 0) {
      return "0,20 100,20";
    }
    const values = trend.map((entry) => entry.r2Bytes + entry.dbBytes);
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const range = Math.max(1, max - min);
    return values
      .map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * 100;
        const y = 40 - ((value - min) / range) * 36 - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [trend]);

  const trendLabel = trend?.length ? `${trend.length}일 추이` : "최근 추이";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Storage Usage</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Storage Usage</h3>
          <p className="text-sm text-slate-500">유료로 사고 싶은 이유를 숫자로 보여줍니다.</p>
        </div>
        <span className={cn("rounded-md border px-3 py-1 text-xs font-semibold", badgeStyles[badgeTone])}>
          {badgeLabel}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {loading && !latest ? (
          <div className="space-y-3">
            <div className="h-3 w-full animate-pulse rounded-md bg-slate-100" />
            <div className="h-7 w-44 animate-pulse rounded-md bg-slate-100" />
            <div className="h-4 w-28 animate-pulse rounded-md bg-slate-100" />
          </div>
        ) : error && !latest ? (
          <button
            type="button"
            onClick={() => void refresh()}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            불러오기 실패 (다시 시도)
          </button>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">사용 중</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatBytes(usedBytes)}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  파일 {resolvedLatest.filesCount.toLocaleString("ko-KR")}개
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">절감</p>
                  {savingsBytes === 0 ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      최적화 준비중
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatBytes(savingsBytes)}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  최적화로 저장소 비용과 로딩을 줄입니다.
                </p>
                {chromePrefs.showSecondaryLinks ? (
                  <Link href="/docs/contact" className="mt-2 inline-flex text-xs font-semibold text-slate-700 underline">
                    문의 / 지원
                  </Link>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">남음 / 쿼터</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatBytes(remainingBytes)}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {formatBytes(usedBytes)} / {formatBytes(quotaBytes)} ({formatPct(usedPct)})
                </p>
                <div className="mt-3 h-2 w-full rounded-md bg-slate-200">
                  <div
                    className={cn(
                      "h-2 rounded-md transition",
                      badgeTone === "danger"
                        ? "bg-rose-500"
                        : badgeTone === "warn"
                          ? "bg-amber-400"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">최근 7일</p>
                <p className="text-sm font-semibold text-slate-700">{trendLabel}</p>
              </div>
              <div className="w-full max-w-[220px]">
                <svg viewBox="0 0 100 40" className="h-10 w-full">
                  <polyline
                    points={sparklinePoints}
                    className={cn("fill-none stroke-[2.5]", sparklineStroke[badgeTone])}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
