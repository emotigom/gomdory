"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type QueueResponse = {
  ok: boolean;
  markdown?: string;
  bundle?: string;
  error?: { message?: string };
};

function buildQuery(params: URLSearchParams) {
  const query = new URLSearchParams();
  const keys = ["hours", "pairs", "recentMinutes", "baselineHours"];
  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }
  const pairValues = params.getAll("pair");
  for (const value of pairValues) {
    query.append("pair", value);
  }
  return query;
}

export default function WorkQueueClient({ apiBaseUrl }: { apiBaseUrl: string }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => buildQuery(searchParams), [searchParams]);

  useEffect(() => {
    const fetchQueue = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams(query);
      params.set("format", "json");
      const url = `${apiBaseUrl}?${params.toString()}`;
      const response = await fetch(url, { method: "GET" });
      const body = (await response.json().catch(() => null)) as QueueResponse | null;
      if (!response.ok || !body?.ok) {
        setError(body?.error?.message ?? "작업 큐를 불러오지 못했습니다.");
        setMarkdown("");
        setLoading(false);
        return;
      }
      setMarkdown(body.markdown ?? body.bundle ?? "");
      setLoading(false);
    };

    void fetchQueue();
  }, [apiBaseUrl, query]);

  const downloadMdParams = new URLSearchParams(query);
  downloadMdParams.set("format", "md");
  const downloadMdUrl = `${apiBaseUrl}?${downloadMdParams.toString()}`;

  const downloadCsvParams = new URLSearchParams(query);
  downloadCsvParams.set("format", "csv");
  const downloadCsvUrl = `${apiBaseUrl}?${downloadCsvParams.toString()}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-700">API에서 생성된 작업 큐 미리보기</p>
          <p className="text-xs text-slate-500">Markdown/CSV로 바로 내려받을 수 있어요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={downloadMdUrl}
            className="dashboard-ops-control rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            작업 큐 (.md)
          </a>
          <a
            href={downloadCsvUrl}
            className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            CSV 내보내기
          </a>
        </div>
      </div>
      {loading ? (
        <div className="dashboard-ops-card rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500" aria-busy="true">불러오는 중...</div>
      ) : error ? (
        <div className="dashboard-ops-card rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : (
        <pre className="dashboard-ops-card max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          {markdown || "표시할 내용이 없습니다."}
        </pre>
      )}
    </section>
  );
}
