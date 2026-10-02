"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import CardTile from "@/app/_components/CardTile";
import { cn } from "@/app/_components/uiTokens";
import { dashboardGlassButtonClass } from "@/app/dashboard/_components/dashboardGlassButton";
import { apiV1Path } from "@/lib/standards/pathTypes";

type SummaryRange = "24h" | "7d";

type SummaryResponse = {
  ok: true;
  requestId: string;
  range: SummaryRange;
  classes: Array<{
    shareCode: string;
    totals: { chat: number; local: number; remote: number; coach: number; retry: number };
    rates: { local: number; fallback: number; retry: number };
    ai: { remoteOk: number; remoteFail: number; p50LatencyMs?: number; p95LatencyMs?: number };
    webllm: {
      blockedCount: number;
      degradedCount: number;
      lastStatus?: { status: string; code: string | null; at: string };
    };
  }>;
};

type SummaryError = {
  message: string;
  requestId?: string | null;
};

const RANGE_OPTIONS: Array<{ value: SummaryRange; label: string; shortLabel: string }> = [
  { value: "24h", label: "최근 24시간", shortLabel: "24시간" },
  { value: "7d", label: "최근 7일", shortLabel: "7일" },
];

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatLatency = (value?: number) => {
  if (!value && value !== 0) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
};

const statusTone = (status?: string | null) => {
  if (!status) return "bg-[var(--theme-surface-2)] text-[var(--theme-text-subtle)]";
  if (status === "READY") return "bg-emerald-100 text-emerald-800";
  if (status === "DEGRADED") return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-800";
};

const statusLabel = (status?: string | null) => {
  if (!status) return "—";
  if (status === "READY") return "원활";
  if (status === "DEGRADED") return "느림";
  return "연결 안 됨";
};

export default function AiTelemetryWidget() {
  const [range, setRange] = useState<SummaryRange>("24h");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<SummaryError | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiV1Path(`teacher/ai-telemetry/summary?range=${range}`), {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | SummaryResponse
        | { ok?: false; requestId?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !payload || !("ok" in payload) || payload.ok !== true) {
        const message =
          (payload && "error" in payload && payload.error?.message) || "요약을 불러오지 못했어요.";
        setError({ message, requestId: payload && "requestId" in payload ? payload.requestId : null });
        setData(null);
        return;
      }
      setData(payload);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "요약을 불러오지 못했어요." });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const sortedClasses = useMemo(() => {
    const classes = data?.classes ?? [];
    return [...classes].sort((a, b) => {
      const fallbackGap = b.rates.fallback - a.rates.fallback;
      if (fallbackGap !== 0) return fallbackGap;
      return a.shareCode.localeCompare(b.shareCode);
    });
  }, [data]);

  const totalChatCount = useMemo(
    () => sortedClasses.reduce((acc, item) => acc + item.totals.chat, 0),
    [sortedClasses],
  );

  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "최근 24시간";

  const renderStatus = (status?: string | null) => (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(status))}>
      {statusLabel(status)}
    </span>
  );

  return (
    <CardTile variant="present" subdued className="dashboard-ai-status-sheet hud-dashboard-panel border border-[var(--theme-border)]/75 bg-[var(--theme-panel-strong)]/80 shadow-none">
      <div className="space-y-4" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--theme-text-muted)]">
              AI 사용 기록
            </p>
            <h2 id="dashboard-ai-connection-heading" className="text-lg font-semibold text-[var(--theme-text)]">반별 연결 상태</h2>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)]">{rangeLabel} 동안 AI 기능이 어떻게 연결됐는지 보여 줍니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="조회 기간">
            {RANGE_OPTIONS.map((option) => {
              const active = option.value === range;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(option.value)}
                  className={cn(
                    dashboardGlassButtonClass(active ? "selected" : "secondary", "px-3 py-2 text-xs"),
                  )}
                >
                  {option.shortLabel}
                </button>
              );
            })}
            <Link href="/edu/selfcheck" className={dashboardGlassButtonClass("secondary", "px-3 py-2 text-xs")}>
              진단 보기
            </Link>
            <button
              type="button"
              onClick={() => void fetchSummary()}
              className={dashboardGlassButtonClass("secondary", "px-3 py-2 text-xs")}
            >
              새로고침
            </button>
          </div>
        </div>

        {loading ? <p className="text-sm text-[var(--theme-text-muted)]" role="status">연결 상태를 불러오는 중...</p> : null}

        {error ? (
          <div role="alert" data-request-id={error.requestId ?? undefined} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span>
              {error.message}
            </span>
            <button
              type="button"
              onClick={() => void fetchSummary()}
              className={dashboardGlassButtonClass("secondary", "px-3 py-2 text-xs")}
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {!loading && !error && sortedClasses.length === 0 ? (
          <p className="text-sm text-[var(--theme-text-muted)]">반 코드가 아직 없어요.</p>
        ) : null}

        {!loading && !error && sortedClasses.length > 0 && totalChatCount === 0 ? (
          <p className="text-sm text-[var(--theme-text-muted)]">{rangeLabel} 동안 채팅 기록이 없어요.</p>
        ) : null}

        {!loading && !error && sortedClasses.length > 0 && totalChatCount > 0 ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="dashboard-ai-connection-heading">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--theme-border)]/70 text-xs text-[var(--theme-text-muted)]">
                <tr>
                  <th className="py-2 pr-3 font-semibold">반 코드</th>
                  <th className="py-2 pr-3 font-semibold">기기에서 처리</th>
                  <th className="py-2 pr-3 font-semibold">온라인으로 전환</th>
                  <th className="py-2 pr-3 font-semibold">다시 시도</th>
                  <th className="py-2 pr-3 font-semibold">온라인 성공 · 응답</th>
                  <th className="py-2 pr-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {sortedClasses.map((item) => {
                  const remoteTotal = item.ai.remoteOk + item.ai.remoteFail;
                  const remoteRate = remoteTotal ? item.ai.remoteOk / remoteTotal : null;
                  const lastStatus = item.webllm.lastStatus;
                  return (
                    <tr key={item.shareCode} className="text-[var(--theme-text-muted)]">
                      <td className="py-3 pr-3 text-xs font-semibold text-[var(--theme-text)]">
                        <span className="rounded-md bg-[var(--theme-surface-2)] px-2 py-1 font-mono text-[12px]">
                          {item.shareCode}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-sm font-semibold text-emerald-700">
                        {formatPercent(item.rates.local)}
                      </td>
                      <td className="py-3 pr-3 text-sm font-semibold text-red-700">
                        {formatPercent(item.rates.fallback)}
                      </td>
                      <td className="py-3 pr-3 text-sm text-[var(--theme-text-subtle)]">
                        {formatPercent(item.rates.retry)}
                      </td>
                      <td className="py-3 pr-3 text-sm text-[var(--theme-text-subtle)]">
                        <div className="flex flex-col gap-1">
                          <span>{remoteRate == null ? "—" : formatPercent(remoteRate)}</span>
                          <span className="text-xs text-[var(--theme-text-muted)]">
                            중간값 {formatLatency(item.ai.p50LatencyMs)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-sm text-[var(--theme-text-subtle)]">
                        {renderStatus(lastStatus?.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </CardTile>
  );
}
