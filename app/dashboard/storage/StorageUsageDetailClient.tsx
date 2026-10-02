"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { formatBytes, formatPct } from "@/lib/format/bytes";
import { apiFetch } from "@/lib/http/apiFetch";

import { calculateUsagePercent, DEFAULT_USAGE_THRESHOLDS, getUsageTier } from "@/lib/storage/usage";

type StorageUsagePayload = {
  day: string;
  r2Bytes: number;
  dbBytes: number;
  filesCount: number;
  optimizedBytesSaved: number;
};

type StorageSavingsPayload = {
  totalSavedBytes: number;
  savedThisMonthBytes: number;
};

type StorageUsageDetailClientProps = {
  freeLimitBytes: number;
  proLimitBytes: number;
};

type FileItem = {
  id: string;
  filename: string;
  bytes: number;
  mime: string | null;
  created_at: string;
  tags: string[];
};

type Toast = {
  id: string;
  tone: "success" | "error";
  message: string;
};

type BadgeTone = "calm" | "warn" | "danger";

const badgeStyles: Record<BadgeTone, string> = {
  calm: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function StorageUsageDetailClient({
  freeLimitBytes,
  proLimitBytes,
}: StorageUsageDetailClientProps) {
  const [usage, setUsage] = useState<StorageUsagePayload | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [savings, setSavings] = useState<StorageSavingsPayload | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(true);
  const [savingsError, setSavingsError] = useState<string | null>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refreshUsage = useCallback(async () => {
    setLoadingUsage(true);
    setUsageError(null);

    try {
      const response = await apiFetch(apiV1Path("storage/usage"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("usage_failed");
      }
      const payload = (await response.json()) as { ok?: boolean; latest?: StorageUsagePayload };
      if (!payload.ok || !payload.latest) {
        throw new Error("usage_failed");
      }
      setUsage(payload.latest);
    } catch (cause) {
      console.error(cause);
      setUsageError("저장소 정보를 불러오지 못했습니다.");
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  const refreshFiles = useCallback(async ({ reset }: { reset: boolean }) => {
    setFilesLoading(true);
    setFilesError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (tagFilter) {
        params.set("tag", tagFilter);
      }
      params.set("limit", "30");
      if (!reset && cursor) {
        params.set("cursor", cursor);
      }
      const response = await apiFetch(apiV1Path(`files?${params.toString()}`), { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        items?: FileItem[];
        nextCursor?: string | null;
      };
      if (!response.ok || payload.ok === false) {
        setFiles((prev) => (reset ? [] : prev));
        setCursor(null);
        setFilesError("최근 파일을 불러오지 못했습니다.");
        return;
      }
      setFiles((prev) => (reset ? payload.items ?? [] : [...prev, ...(payload.items ?? [])]));
      setCursor(payload.nextCursor ?? null);
    } catch (cause) {
      console.error(cause);
      setFilesError("최근 파일을 불러오지 못했습니다.");
    } finally {
      setFilesLoading(false);
    }
  }, [cursor, query, tagFilter]);

  const refreshSavings = useCallback(async () => {
    setSavingsLoading(true);
    setSavingsError(null);

    try {
      const response = await apiFetch(apiV1Path("storage/savings"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("savings_failed");
      }
      const payload = (await response.json()) as { ok?: boolean } & StorageSavingsPayload;
      if (!payload.ok) {
        throw new Error("savings_failed");
      }
      setSavings({
        totalSavedBytes: payload.totalSavedBytes ?? 0,
        savedThisMonthBytes: payload.savedThisMonthBytes ?? 0,
      });
    } catch (cause) {
      console.error(cause);
      setSavingsError("절감 지표를 불러오지 못했습니다.");
    } finally {
      setSavingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const isProUser = false;

  useEffect(() => {
    if (!isProUser) {
      setSavings(null);
      setSavingsLoading(false);
      return;
    }
    void refreshSavings();
  }, [isProUser, refreshSavings]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refreshFiles({ reset: true });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [refreshFiles]);

  const limitBytes = freeLimitBytes;
  const usedBytes = usage ? usage.r2Bytes + usage.dbBytes : 0;
  const usedPct = useMemo(() => calculateUsagePercent(usedBytes, limitBytes), [limitBytes, usedBytes]);
  const badge = useMemo(() => getUsageBadge(usedPct), [usedPct]);

  const usedLabel = usage ? formatBytes(usedBytes) : "-";
  const limitLabel = usage ? formatBytes(limitBytes) : "-";
  const totalSavedLabel = savings ? formatBytes(savings.totalSavedBytes) : "-";
  const monthlySavedLabel = savings ? formatBytes(savings.savedThisMonthBytes) : "-";

  const tagPalette = useMemo(() => {
    const tags = new Set<string>();
    files.forEach((file) => {
      file.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags.values());
  }, [files]);

  function pushToast(tone: Toast["tone"], message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3600);
  }

  async function handleCopyLink(fileId: string) {
    try {
      const url = `${window.location.origin}${apiV1Path(`files/${fileId}/view`)}`;
      await navigator.clipboard.writeText(url);
      pushToast("success", "링크를 복사했습니다.");
    } catch (cause) {
      console.error(cause);
      pushToast("error", "링크 복사에 실패했습니다.");
    }
  }

  async function handleDelete(fileId: string) {
    const confirmed = window.confirm("이 파일을 삭제할까요? (복구는 추후 지원됩니다)");
    if (!confirmed) return;

    try {
      const response = await apiFetch(apiV1Path(`files/${fileId}/delete`), { method: "POST" });
      if (!response.ok) {
        throw new Error("delete_failed");
      }
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      pushToast("success", "파일을 삭제했습니다.");
    } catch (cause) {
      console.error(cause);
      pushToast("error", "파일 삭제에 실패했습니다.");
    }
  }

  async function handleSaveTags(fileId: string) {
    const raw = tagDrafts[fileId] ?? "";
    const tags = raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const response = await apiFetch(apiV1Path(`files/${fileId}/tags`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!response.ok) {
        throw new Error("tags_failed");
      }
      const payload = (await response.json()) as { ok?: boolean; item?: FileItem };
      if (!payload.ok || !payload.item) {
        throw new Error("tags_failed");
      }
      setFiles((prev) => prev.map((file) => (file.id === fileId ? { ...file, tags: payload.item?.tags ?? [] } : file)));
      setEditingId(null);
      pushToast("success", "태그를 저장했습니다.");
    } catch (cause) {
      console.error(cause);
      pushToast("error", "태그 저장에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg",
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Storage</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900">저장소 사용량</h1>
            <p className="text-sm text-slate-500">최근 업로드와 용량 상태를 바로 확인하세요.</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-4 py-1 text-sm font-semibold",
              badgeStyles[badge.tone],
            )}
          >
            {badge.label}
          </span>
        </div>

        {loadingUsage ? (
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-10 w-52 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : usageError ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {usageError}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="h-5 w-full rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-5 rounded-full transition",
                  badge.tone === "danger"
                    ? "bg-rose-500"
                    : badge.tone === "warn"
                      ? "bg-amber-400"
                      : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, usedPct)}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <p className="text-4xl font-bold text-slate-900">{usedLabel}</p>
              <p className="text-lg font-semibold text-slate-500">/ {limitLabel}</p>
              <span className="text-sm font-semibold text-slate-500">{formatPct(usedPct)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                임계치: {DEFAULT_USAGE_THRESHOLDS.warn}% 주의 · {DEFAULT_USAGE_THRESHOLDS.danger}% 위험
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Free {formatBytes(freeLimitBytes)} / Pro {formatBytes(proLimitBytes)}
            </p>
            {isProUser ? (
              <p className="text-sm text-slate-500">
                Pro 플랜은 최적화로 절감된 용량을 함께 안내합니다.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshUsage}
            data-interactive
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">절감 지표</h2>
            <p className="text-sm text-slate-500">최적화·중복 제거로 얼마나 아꼈는지 보여줘요.</p>
          </div>
          {!isProUser ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Pro 전용
            </span>
          ) : null}
        </div>

        {isProUser ? (
          savingsLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-6 w-40 animate-pulse rounded-full bg-slate-100" />
              <div className="h-4 w-52 animate-pulse rounded-full bg-slate-100" />
            </div>
          ) : savingsError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {savingsError}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">이번 달 절감</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">{monthlySavedLabel}</p>
                <p className="text-xs text-emerald-700/80">이미지 최적화 + 중복 제거</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">누적 절감</p>
                <p className="mt-2 text-2xl font-bold text-indigo-700">{totalSavedLabel}</p>
                <p className="text-xs text-indigo-700/80">업로드 전체 누적 합계</p>
              </div>
            </div>
          )
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            Pro에서는 이번 달/누적 절감 지표를 확인할 수 있어요.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">최근 파일</h2>
              <p className="text-sm text-slate-500">최근 업로드한 파일을 바로 정리하세요.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="파일 이름 검색"
                className="min-h-[44px] w-48 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
              />
              <select
                value={tagFilter ?? ""}
                onChange={(event) => setTagFilter(event.target.value || null)}
                className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
              >
                <option value="">태그 전체</option>
                {tagPalette.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filesError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {filesError}
            </div>
          ) : null}

          {filesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              아직 업로드한 파일이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((file) => {
                const editing = editingId === file.id;
                const draft = tagDrafts[file.id] ?? file.tags?.join(", ") ?? "";
                return (
                  <div key={file.id} className="flex h-full flex-col rounded-2xl border border-slate-200 p-4">
                    <div className="flex-1 space-y-2">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{file.filename}</p>
                      <div className="text-xs text-slate-500">
                        <span>{formatBytes(file.bytes)}</span>
                        <span className="mx-2 text-slate-300">•</span>
                        <span>{file.mime ?? "파일"}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(file.created_at).toLocaleDateString("ko-KR")}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(file.tags ?? []).length > 0 ? (
                          file.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                            >
                              #{tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400">태그 없음</span>
                        )}
                      </div>
                    </div>

                    {editing ? (
                      <div className="mt-3 space-y-2">
                        <input
                          value={draft}
                          onChange={(event) =>
                            setTagDrafts((prev) => ({ ...prev, [file.id]: event.target.value }))
                          }
                          placeholder="tag1, tag2"
                          className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveTags(file.id)}
                            className="min-h-[44px] flex-1 rounded-full bg-indigo-600 px-3 text-sm font-semibold text-white"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[44px] flex-1 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(file.id);
                            setTagDrafts((prev) => ({ ...prev, [file.id]: file.tags?.join(", ") ?? "" }));
                          }}
                          className="min-h-[44px] flex-1 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600"
                        >
                          태그
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(file.id)}
                          className="min-h-[44px] flex-1 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600"
                        >
                          링크 복사
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(file.id)}
                          className="min-h-[44px] flex-1 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {cursor && !filesLoading ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void refreshFiles({ reset: false })}
                className="min-h-[44px] rounded-full border border-slate-200 px-6 text-sm font-semibold text-slate-600"
              >
                더 불러오기
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function getUsageBadge(usedPct: number) {
  const tier = getUsageTier(usedPct);
  if (tier === "danger") {
    return { label: "위험", tone: "danger" } as const;
  }
  if (tier === "warn") {
    return { label: "주의", tone: "warn" } as const;
  }
  return { label: "여유", tone: "calm" } as const;
}
