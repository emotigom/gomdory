"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useState } from "react";

import type { BoardRole } from "@/lib/auth/boardRoles";

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  actorRole: BoardRole | null;
  meta: Record<string, unknown>;
  requestId: string | null;
};

type Props = {
  boardId: string;
  initialItems: AuditLogItem[];
  initialCursor: string | null;
};

const FILTERS = [
  { label: "전체", value: "" },
  { label: "카드", value: "card." },
  { label: "협업", value: "collab." },
];

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

function formatTarget(log: AuditLogItem) {
  if (log.targetType && log.targetId) {
    return `${log.targetType} · ${log.targetId}`;
  }
  if (log.targetType) {
    return log.targetType;
  }
  return log.targetId ?? "-";
}

export default function AuditLogViewer({ boardId, initialItems, initialCursor }: Props) {
  const [items, setItems] = useState<AuditLogItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [actionPrefix, setActionPrefix] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetLabel = useMemo(() => {
    const filter = FILTERS.find((item) => item.value === actionPrefix);
    return filter?.label ?? "전체";
  }, [actionPrefix]);

  async function fetchLogs(nextCursor?: string | null) {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "50" });
    if (actionPrefix) {
      params.set("actionPrefix", actionPrefix);
    }
    if (nextCursor) {
      params.set("cursor", nextCursor);
    }

    const response = await fetch(apiV1Path(`boards/${boardId}/audit?${params.toString()}`), {
      cache: "no-store",
    });

    if (!response.ok) {
      setIsLoading(false);
      setError("로그를 불러오지 못했습니다.");
      return;
    }

    const data = (await response.json()) as {
      ok: boolean;
      items: AuditLogItem[];
      nextCursor: string | null;
    };

    if (!data.ok) {
      setIsLoading(false);
      setError("로그를 불러오지 못했습니다.");
      return;
    }

    setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
    setCursor(data.nextCursor);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchLogs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionPrefix]);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">최근 활동</p>
          <p className="text-xs text-gray-500">{targetLabel} 로그 최대 50개씩 조회합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-700" htmlFor="audit-filter">
            액션 필터
          </label>
          <select
            id="audit-filter"
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
            value={actionPrefix}
            onChange={(event) => setActionPrefix(event.target.value)}
            disabled={isLoading}
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">시간</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">액션</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">대상</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">사용자</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">역할</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-3 py-2 text-gray-900">{formatDate(log.createdAt)}</td>
                <td className="px-3 py-2 text-gray-900">{log.action}</td>
                <td className="px-3 py-2 text-gray-700">{formatTarget(log)}</td>
                <td className="px-3 py-2 text-gray-700">{log.actorUserId ?? "-"}</td>
                <td className="px-3 py-2 text-gray-700">{log.actorRole ?? "-"}</td>
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => fetchLogs(cursor)}
          disabled={isLoading || !cursor}
        >
          더 보기
        </button>
        {isLoading ? <span className="text-sm text-gray-500">불러오는 중...</span> : null}
      </div>
    </div>
  );
}
