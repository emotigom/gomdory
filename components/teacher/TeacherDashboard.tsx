"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiV1Path } from "@/lib/standards/pathTypes";
import { truncateViewerName } from "@/lib/share/normalizeViewerName";

type OverviewLatest = {
  slug: string | null;
  version: number;
  publish_state: string;
  public_url: string | null;
  classroom_url: string | null;
  preview_url: string | null;
  last_published_at: string | null;
  request_id: string | null;
};

type OverviewEntry = {
  anon_id: string | null;
  viewer_name: string;
  lesson_id: number | null;
  latest: OverviewLatest;
  stats: { versions: number };
  last_error: { code: string; message: string | null; request_id: string | null; at: string | null } | null;
};

type OverviewResponse =
  | { ok: true; requestId: string; students: OverviewEntry[] }
  | { ok: false; requestId?: string; error?: { message?: string } };

type RetryResponse =
  | { ok: true; requestId: string; publish: { slug: string; version: number } }
  | { ok: false; requestId?: string; error?: { message?: string } };

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "게시됨",
  FAILED: "실패",
  PUBLISHING: "게시중",
  VALIDATING: "검증중",
  NONE: "없음",
  UNKNOWN: "확인중",
};

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  PUBLISHING: "bg-amber-50 text-amber-700 ring-amber-200",
  VALIDATING: "bg-blue-50 text-blue-700 ring-blue-200",
  NONE: "bg-slate-50 text-slate-500 ring-slate-200",
  UNKNOWN: "bg-slate-50 text-slate-500 ring-slate-200",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function selectLatestUrl(latest: OverviewLatest) {
  return latest.public_url ?? latest.classroom_url ?? latest.preview_url ?? null;
}

function resolveBaseSlug(slug: string | null) {
  if (!slug) return null;
  return slug.replace(/-v\d+$/, "");
}

async function copyToClipboard(value: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore
  }
}

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path
      d="M20 12a8 8 0 1 1-2.34-5.66"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path d="M20 4v6h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="5" y="5" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const OpenIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path d="M14 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M10 14L19 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const RetryIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path d="M4 12a8 8 0 1 0 2.34-5.66" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 4v6h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export default function TeacherDashboard({ shareCode }: { shareCode: string }) {
  const [students, setStudents] = useState<OverviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);

  const requestUrl = useMemo(
    () => apiV1Path(`edu/teacher/classroom/${encodeURIComponent(shareCode)}/overview`),
    [shareCode],
  );

  const refresh = useCallback(async () => {
    if (!shareCode) return;
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(requestUrl, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as OverviewResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && "error" in payload ? payload.error?.message ?? "불러오기 실패" : "불러오기 실패");
      }
      setStudents(payload.students ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "상태를 불러오지 못했습니다.";
      setError(message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [requestUrl, shareCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRetry = useCallback(
    async (entry: OverviewEntry) => {
      if (!entry.anon_id || !entry.lesson_id) return;
      const key = `${entry.anon_id}:${entry.lesson_id}`;
      setRetryingKey(key);
      setError(null);
      try {
        const response = await fetch(apiV1Path("edu/teacher/publish/retry"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            share_code: shareCode,
            anon_id: entry.anon_id,
            lesson_id: entry.lesson_id,
            base_slug: resolveBaseSlug(entry.latest.slug),
          }),
        });
        const payload = (await response.json().catch(() => null)) as RetryResponse | null;
        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && "error" in payload ? payload.error?.message ?? "재시도 실패" : "재시도 실패");
        }
        await refresh();
      } catch (retryError) {
        const message = retryError instanceof Error ? retryError.message : "재시도를 완료하지 못했습니다.";
        setError(message);
      } finally {
        setRetryingKey(null);
      }
    },
    [refresh, shareCode],
  );

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Teacher Overview</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">게시 현황</h1>
            <p className="mt-2 text-sm text-slate-600">반 코드: <span className="font-mono">{shareCode}</span></p>
          </div>
          <button
            type="button"
            onClick={refresh}
            aria-label="새로고침"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <RefreshIcon className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-500">게시 상태를 불러오는 중...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && !error && students.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          아직 게시 기록이 없습니다.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {students.map((entry) => {
          const latestUrl = selectLatestUrl(entry.latest);
          const statusLabel = STATUS_LABELS[entry.latest.publish_state] ?? entry.latest.publish_state;
          const statusStyle = STATUS_STYLES[entry.latest.publish_state] ?? STATUS_STYLES.UNKNOWN;
          const anonTail = entry.anon_id ? entry.anon_id.slice(-6) : "--";
          const rid = entry.last_error?.request_id ?? entry.latest.request_id;
          const retryKey = `${entry.anon_id ?? "na"}:${entry.lesson_id ?? "na"}`;
          const canRetry = entry.latest.publish_state === "FAILED";
          const displayName = truncateViewerName(entry.viewer_name, 12);
          return (
            <article key={`${entry.anon_id ?? "na"}-${entry.lesson_id ?? "na"}`} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="max-w-[12rem] truncate text-base font-semibold text-slate-900">{displayName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                      {anonTail}
                    </span>
                    {entry.lesson_id ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        L{entry.lesson_id}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">최근 게시: {formatDate(entry.latest.last_published_at)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyle}`}>
                  {statusLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                  v{entry.stats.versions}
                </span>
                {latestUrl ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
                    링크 준비됨
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-50 px-2 py-0.5 font-semibold text-slate-400">
                    링크 없음
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyToClipboard(latestUrl ?? "")}
                  aria-label="최신 링크 복사"
                  disabled={!latestUrl}
                  className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    latestUrl
                      ? "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      : "cursor-not-allowed border-slate-100 text-slate-300"
                  }`}
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
                <a
                  href={latestUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="최신 링크 열기"
                  className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    latestUrl
                      ? "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      : "pointer-events-none border-slate-100 text-slate-300"
                  }`}
                >
                  <OpenIcon className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(rid ?? "")}
                  aria-label="RID 복사"
                  disabled={!rid}
                  className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    rid
                      ? "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      : "cursor-not-allowed border-slate-100 text-slate-300"
                  }`}
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleRetry(entry)}
                  aria-label="재시도"
                  disabled={!canRetry || retryingKey === retryKey}
                  className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition ${
                    canRetry
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  <RetryIcon className="h-4 w-4" />
                </button>
              </div>

              {rid ? <p className="mt-3 text-xs text-slate-500">RID: <span className="font-mono">{rid}</span></p> : null}

              {entry.last_error ? (
                <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold">
                      {entry.last_error.code}
                    </span>
                    <span className="text-[11px] text-rose-500">{formatDate(entry.last_error.at)}</span>
                  </div>
                  {entry.last_error.message ? (
                    <p className="mt-2 truncate text-rose-700">{entry.last_error.message}</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
