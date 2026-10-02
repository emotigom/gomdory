"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

type LessonKey = "P1" | "P2" | "P3" | "P4";

type CompletionResponse =
  | {
      ok: true;
      items: Array<{
        lessonKey: LessonKey;
        attend: number;
        done: number;
        rate: number;
      }>;
      dayBucket: string;
      hasClass: boolean;
    }
  | { ok: false; error?: string };

const LESSON_LABELS: Array<{ key: LessonKey; label: string }> = [
  { key: "P1", label: "1교시" },
  { key: "P2", label: "2교시" },
  { key: "P3", label: "3교시" },
  { key: "P4", label: "4교시" },
];

type EduCompletionPanelProps = {
  boardId: string;
};

export default function EduCompletionPanel({ boardId }: EduCompletionPanelProps) {
  const [items, setItems] = useState<Record<LessonKey, { attend: number; done: number; rate: number }>>({
    P1: { attend: 0, done: 0, rate: 0 },
    P2: { attend: 0, done: 0, rate: 0 },
    P3: { attend: 0, done: 0, rate: 0 },
    P4: { attend: 0, done: 0, rate: 0 },
  });
  const [dayBucket, setDayBucket] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasClass, setHasClass] = useState(true);

  const endpoint = useMemo(
    () => apiV1Path(`dashboard/edu/completions?boardId=${encodeURIComponent(boardId)}`),
    [boardId],
  );

  const fetchCompletions = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(endpoint, { method: "GET" });
      const payload = (await response.json().catch(() => null)) as CompletionResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        setError(payload && "error" in payload ? payload.error ?? "완료 현황을 불러오지 못했습니다." : "완료 현황을 불러오지 못했습니다.");
        return;
      }

      const nextItems: Record<LessonKey, { attend: number; done: number; rate: number }> = {
        P1: { attend: 0, done: 0, rate: 0 },
        P2: { attend: 0, done: 0, rate: 0 },
        P3: { attend: 0, done: 0, rate: 0 },
        P4: { attend: 0, done: 0, rate: 0 },
      };
      for (const entry of payload.items ?? []) {
        const key = entry.lessonKey;
        nextItems[key] = {
          attend: entry.attend ?? 0,
          done: entry.done ?? 0,
          rate: entry.rate ?? 0,
        };
      }
      setItems(nextItems);
      setDayBucket(payload.dayBucket ?? null);
      setHasClass(payload.hasClass);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "완료 현황을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, endpoint]);

  useEffect(() => {
    void fetchCompletions();
  }, [fetchCompletions]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">레슨 완료 현황 (오늘)</p>
          <p className="text-[11px] text-slate-500">오늘 기준</p>
        </div>
        <button
          type="button"
          onClick={fetchCompletions}
          aria-label="완료 현황 새로고침"
          className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          ⟳
        </button>
      </div>

      {!hasClass ? (
        <p className="text-[11px] text-slate-400">수업 링크를 만든 뒤 완료 현황이 표시됩니다.</p>
      ) : null}

      <div className="space-y-2">
        {LESSON_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1">
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
            <span className="text-[11px] font-semibold text-slate-800">
              {items[key].done}/{items[key].attend} ({items[key].rate}%)
            </span>
          </div>
        ))}
      </div>

      {dayBucket ? <p className="text-[10px] text-slate-400">{dayBucket} 집계</p> : null}
      {loading ? <p className="text-[10px] text-slate-400">불러오는 중...</p> : null}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
