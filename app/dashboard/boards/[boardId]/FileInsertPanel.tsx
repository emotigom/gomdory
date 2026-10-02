"use client";
import { apiPath } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { formatBytes } from "@/lib/format/bytes";
import { apiFetch } from "@/lib/http/apiFetch";

import { routes } from "@/lib/standards/routes";

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

type FileInsertPanelProps = {
  boardId: string;
};

export default function FileInsertPanel({ boardId }: FileInsertPanelProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const fetchFiles = useCallback(async () => {
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
      params.set("limit", "12");
      const response = await apiFetch(apiPath(`${routes.api.files.list()}?${params.toString()}`), {
        cache: "no-store",
      });
      const payload = (await response.json()) as { ok?: boolean; items?: FileItem[] };
      if (!response.ok || payload.ok === false) {
        setFiles([]);
        setFilesError("파일 목록을 불러오지 못했습니다.");
        return;
      }
      setFiles(payload.items ?? []);
    } catch (cause) {
      console.error(cause);
      setFilesError("파일 목록을 불러오지 못했습니다.");
    } finally {
      setFilesLoading(false);
    }
  }, [query, tagFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchFiles();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [fetchFiles]);

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
    }, 3200);
  }

  async function handleInsert(fileId: string) {
    try {
      const response = await apiFetch(routes.api.boards.byId(boardId, "files", "insert"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (!response.ok) {
        throw new Error("insert_failed");
      }
      setInsertedIds((prev) => new Set(prev).add(fileId));
      pushToast("success", "보드에 추가됨");
    } catch (cause) {
      console.error(cause);
      pushToast("error", "보드에 추가하지 못했습니다.");
    }
  }

  return (
    <section className="relative space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="pointer-events-none absolute inset-x-0 -top-4 flex flex-col items-center gap-2 px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-2 text-sm font-semibold shadow-lg",
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Quick Insert</p>
          <h3 className="text-xl font-bold text-slate-900">파일 삽입</h3>
          <p className="text-sm text-slate-500">최근 업로드 파일을 보드에 바로 추가하세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="파일 이름 검색"
            className="min-h-[44px] w-40 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          최근 파일이 없습니다. 먼저 업로드해 주세요.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => {
            const inserted = insertedIds.has(file.id);
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

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={inserted}
                    onClick={() => void handleInsert(file.id)}
                    className={cn(
                      "min-h-[44px] flex-1 rounded-full px-3 text-sm font-semibold transition",
                      inserted
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "bg-indigo-600 text-white hover:bg-indigo-700",
                    )}
                  >
                    {inserted ? "삽입됨" : "보드에 삽입"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
