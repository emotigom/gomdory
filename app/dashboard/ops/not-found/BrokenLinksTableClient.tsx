"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import MatchingPatternsDialog, { type MatchingPatternItem } from "./MatchingPatternsDialog";

type Effect = {
  recentPerHour: number;
  baselinePerHour: number;
  deltaPct: number;
  trend: "improving" | "worsening" | "new" | "flat";
};

type RowItem = {
  key: string;
  referrerPath: string;
  referrerExists: boolean;
  notFoundRoute: string;
  estimated: number;
  sampled: number;
  lastSeenTs: string;
  recommendation: {
    kindLabel: string;
    best: string;
    bestFrom: string | null;
    referrer404Warn: number | null;
  };
  effect: Effect;
  aliasCandidates: Array<{
    reason: "target" | "referrer";
    from: string;
    to: string;
    collision: { status: "safe" | "warn" | "conflict"; matches: MatchingPatternItem[] };
  }>;
};

type EffectTotals = {
  recentMinutes: number;
  baselineHours: number;
  recentEstimatedPerHour: number;
  baselineEstimatedPerHour: number;
  deltaPct: number;
};

function boolBadge(value: boolean) {
  return value ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">exists</span>
  ) : (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">missing</span>
  );
}

function trendLabel(trend: Effect["trend"]) {
  switch (trend) {
    case "improving":
      return "↓개선";
    case "worsening":
      return "↑악화";
    case "new":
      return "NEW";
    default:
      return "—";
  }
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function buildPairParam(row: RowItem) {
  return JSON.stringify({ r: row.referrerPath, t: row.notFoundRoute });
}

export default function BrokenLinksTableClient({
  rows,
  csvUrl,
  bundleUrl,
  workQueueApiUrl,
  workQueuePageUrl,
  effectTotals,
  defaultHours,
}: {
  rows: RowItem[];
  csvUrl: string;
  bundleUrl: string;
  workQueueApiUrl: string;
  workQueuePageUrl: string;
  effectTotals: EffectTotals;
  defaultHours: number;
}) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set<string>());

  const allSelected = rows.length > 0 && selectedKeys.size === rows.length;
  const selectedRows = useMemo(() => rows.filter((row) => selectedKeys.has(row.key)), [rows, selectedKeys]);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(rows.map((row) => row.key)));
  };

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const buildWorkQueueUrl = (baseUrl: string, options?: { format?: "md" | "json" }) => {
    const params = new URLSearchParams();
    if (options?.format) {
      params.set("format", options.format);
    }
    params.set("hours", String(defaultHours));
    params.set("recentMinutes", String(effectTotals.recentMinutes));
    params.set("baselineHours", String(effectTotals.baselineHours));
    for (const row of selectedRows) {
      params.append("pair", buildPairParam(row));
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const selectedCount = selectedRows.length;

  return (
    <div className="mt-4 space-y-4">
      <div className="dashboard-ops-card rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">효과 요약 (최근 {effectTotals.recentMinutes}m vs {effectTotals.baselineHours}h avg/h)</p>
        <p className="mt-1 text-sm text-slate-700">
          recent/h <span className="font-semibold">{effectTotals.recentEstimatedPerHour.toFixed(1)}</span> · baseline/h{" "}
          <span className="font-semibold">{effectTotals.baselineEstimatedPerHour.toFixed(1)}</span> · delta{" "}
          <span className="font-semibold">{formatPct(effectTotals.deltaPct)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <button
            type="button"
            onClick={toggleAll}
            className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
          <span>선택 {selectedCount}개</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 ? (
            <a
              href={buildWorkQueueUrl(workQueueApiUrl, { format: "md" })}
              className="dashboard-ops-control rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              작업 큐 다운로드 (.md)
            </a>
          ) : (
            <span className="dashboard-ops-control rounded-full border border-slate-200 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500" aria-disabled="true">
              작업 큐 다운로드 (.md)
            </span>
          )}
          {selectedCount > 0 ? (
            <Link
              href={buildWorkQueueUrl(workQueuePageUrl)}
              className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              작업 큐 보기
            </Link>
          ) : (
            <span className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400" aria-disabled="true">
              작업 큐 보기
            </span>
          )}
          <Link
            href={csvUrl}
            className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            CSV 다운로드
          </Link>
          <Link
            href={bundleUrl}
            className="dashboard-ops-control rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            조사 번들(.md)
          </Link>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">
                <span className="sr-only">select</span>
              </th>
              <th className="py-2">from (referrer)</th>
              <th className="py-2">to (404 route)</th>
              <th className="py-2">추천</th>
              <th className="py-2">라우트 매칭(Top 3)</th>
              <th className="py-2 text-right">estimated</th>
              <th className="py-2 text-right">sampled</th>
              <th className="py-2">last seen</th>
              <th className="py-2">효과</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 text-slate-500" colSpan={9}>
                  내부 referrer 404가 아직 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="dashboard-ops-row border-t border-slate-100">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row.key)}
                      onChange={() => toggleRow(row.key)}
                      aria-label={`${row.referrerPath} -> ${row.notFoundRoute}`}
                      className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link href={row.referrerPath} className="dashboard-ops-text-link break-all font-mono text-xs text-sky-700">
                        {row.referrerPath}
                      </Link>
                      {boolBadge(row.referrerExists)}
                    </div>
                  </td>
                  <td className="max-w-[16rem] break-all py-2 font-mono text-xs text-slate-700">{row.notFoundRoute}</td>
                  <td className="py-2">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-800">{row.recommendation.kindLabel}</p>
                      <p className="break-all font-mono text-xs text-slate-500">{row.recommendation.best}</p>
                      {row.recommendation.bestFrom ? (
                        <p className="break-all font-mono text-xs text-rose-600">from→ {row.recommendation.bestFrom}</p>
                      ) : null}
                      {row.recommendation.referrer404Warn ? (
                        <p className="text-xs text-amber-700">referrer 404 est {row.recommendation.referrer404Warn}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2">
                    {row.aliasCandidates.length === 0 ? (
                      <p className="text-xs text-slate-400">—</p>
                    ) : (
                      <div className="space-y-1">
                        {row.aliasCandidates.map((a) => {
                          const label = a.reason === "referrer" ? "referrer alias" : "target alias";
                          const k = `${label}:${a.from}->${a.to}`;

                          return (
                            <div key={k} className="dashboard-ops-row rounded-md border border-transparent bg-slate-50 px-2 py-1">
                              <p className="break-all text-xs text-slate-700">
                                <span className="font-semibold">{label}</span>: <span className="font-mono">{a.from}</span> →{" "}
                                <span className="font-mono">{a.to}</span>
                              </p>

                              {a.collision.status === "safe" ? (
                                <span className="mt-1 inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  ✅ safe
                                </span>
                              ) : a.collision.status === "conflict" ? (
                                <span className="mt-1 inline-flex w-fit rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                  ⚠️ conflict
                                </span>
                              ) : (
                                <div className="mt-1">
                                  <MatchingPatternsDialog items={a.collision.matches} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900">{row.estimated}</td>
                  <td className="py-2 text-right text-slate-700">{row.sampled}</td>
                  <td className="py-2 text-xs text-slate-500">{new Date(row.lastSeenTs).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">
                        {trendLabel(row.effect.trend)} · {formatPct(row.effect.deltaPct)}
                      </p>
                      <p>
                        {row.effect.recentPerHour.toFixed(1)}/h → {row.effect.baselinePerHour.toFixed(1)}/h
                      </p>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
