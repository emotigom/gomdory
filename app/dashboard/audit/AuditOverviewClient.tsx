"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useMemo, useState } from "react";

import type { AuditOverviewItem } from "./page";

type BoardOption = {
  id: string;
  title: string;
};

type Props = {
  boards: BoardOption[];
  initialItems: AuditOverviewItem[];
};

const ACTION_PRESETS = [
  { label: "전체", value: "" },
  { label: "보드", value: "board." },
  { label: "공유", value: "share." },
  { label: "학생 요청", value: "student_action." },
  { label: "승인/트리아지", value: "triage." },
  { label: "파일", value: "file." },
  { label: "로그인", value: "auth." },
];

const PERIOD_OPTIONS = [
  { label: "전체", value: "all" },
  { label: "최근 7일", value: "7d" },
  { label: "최근 30일", value: "30d" },
  { label: "최근 90일", value: "90d" },
];

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

function formatTarget(item: AuditOverviewItem) {
  if (item.targetType && item.targetId) {
    return `${item.targetType} · ${item.targetId}`;
  }
  return item.targetType ?? item.targetId ?? "-";
}

function resolvePeriodRange(period: string) {
  if (period === "all") return { start: null, end: null };
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  if (!days) return { start: null, end: null };
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: now.toISOString() };
}

export default function AuditOverviewClient({ boards, initialItems }: Props) {
  const [items, setItems] = useState<AuditOverviewItem[]>(initialItems);
  const [boardId, setBoardId] = useState<string>("");
  const [actionPrefix, setActionPrefix] = useState<string>("");
  const [period, setPeriod] = useState<string>("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boardLabel = useMemo(() => {
    if (!boardId) return "전체";
    return boards.find((board) => board.id === boardId)?.title ?? "선택됨";
  }, [boardId, boards]);

  async function refresh() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: "200" });
    if (boardId) params.set("boardId", boardId);
    if (actionPrefix) params.set("actionPrefix", actionPrefix);
    const { start, end } = resolvePeriodRange(period);
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    try {
      const response = await fetch(apiV1Path(`audit?${params.toString()}`), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("fetch_failed");
      }
      const payload = (await response.json()) as { ok: boolean; items: AuditOverviewItem[] };
      if (!payload.ok) {
        throw new Error("fetch_failed");
      }
      setItems(payload.items ?? []);
    } catch {
      setError("로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">최근 200개</p>
          <p className="text-xs text-gray-500">
            {boardLabel} · {ACTION_PRESETS.find((preset) => preset.value === actionPrefix)?.label ?? "전체"} ·
            {PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "전체"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={boardId}
            onChange={(event) => setBoardId(event.target.value)}
            disabled={loading}
          >
            <option value="">모든 보드</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={actionPrefix}
            onChange={(event) => setActionPrefix(event.target.value)}
            disabled={loading}
          >
            {ACTION_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={loading}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            새로고침
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">시간</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">보드</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">액션</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">대상</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">사용자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap px-3 py-2 text-gray-900">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-2 text-gray-700">
                  {item.boardId ? boards.find((board) => board.id === item.boardId)?.title ?? item.boardId : "계정"}
                </td>
                <td className="px-3 py-2 text-gray-900">{item.action}</td>
                <td className="px-3 py-2 text-gray-700">{formatTarget(item)}</td>
                <td className="px-3 py-2 text-gray-700">{item.actorUserId ?? "-"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  표시할 로그가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
