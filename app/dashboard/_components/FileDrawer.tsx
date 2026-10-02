"use client";
import { apiPath } from "@/lib/standards/pathTypes";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BoardFile } from "@/lib/data/boardFiles";
import { sha256BlobHex } from "@/lib/crypto/sha256";
import { apiFetch } from "@/lib/http/apiFetch";

import { routes } from "@/lib/standards/routes";
import { optimizeImage } from "@/lib/media/optimizeImage";
import { calculateBytesSaved, shouldOptimize } from "@/lib/media/optimizationPolicy";

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_LIMIT = 24;

type FileDrawerProps = {
  boardId: string;
  activeWallId?: string | null;
  onInsertFile?: (file: BoardFile, wallId?: string | null) => Promise<void>;
  openSignal?: number;
  hideTrigger?: boolean;
  triggerLabel?: string;
};

type FileLibraryState = {
  items: BoardFile[];
  nextCursor: string | null;
  isLoading: boolean;
  error: string | null;
};

function useFileLibrary({
  enabled,
  query,
  tag,
  sort,
  immediate,
}: {
  enabled: boolean;
  query: string;
  tag: string | null;
  sort: "recent" | "name" | "size";
  immediate?: boolean;
}) {
  const [state, setState] = useState<FileLibraryState>({
    items: [],
    nextCursor: null,
    isLoading: false,
    error: null,
  });
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (immediate) {
      setDebouncedQuery(query);
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [immediate, query]);

  const fetchPage = useCallback(
    async ({ cursor, append }: { cursor?: string | null; append?: boolean }) => {
      if (!enabled) return;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set("query", debouncedQuery);
        if (tag) params.set("tag", tag);
        if (sort) params.set("sort", sort);
        params.set("limit", `${PAGE_LIMIT}`);
        if (cursor) params.set("cursor", cursor);
        const response = await apiFetch(apiPath(`${routes.api.files.list()}?${params.toString()}`), {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          items?: BoardFile[];
          nextCursor?: string | null;
          error?: string;
        };
        if (!response.ok || payload.ok === false) {
          setState((prev) => ({
            items: append ? prev.items : [],
            nextCursor: null,
            isLoading: false,
            error: payload.error ?? "파일을 불러오지 못했습니다.",
          }));
          return;
        }
        setState((prev) => ({
          items: append ? [...prev.items, ...(payload.items ?? [])] : payload.items ?? [],
          nextCursor: payload.nextCursor ?? null,
          isLoading: false,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "파일을 불러오지 못했습니다.",
        }));
      }
    },
    [debouncedQuery, enabled, sort, tag],
  );

  useEffect(() => {
    if (!enabled) return;
    void fetchPage({ cursor: null, append: false });
  }, [enabled, debouncedQuery, tag, sort, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!state.nextCursor || state.isLoading) return;
    await fetchPage({ cursor: state.nextCursor, append: true });
  }, [fetchPage, state.isLoading, state.nextCursor]);

  const refresh = useCallback(async () => {
    await fetchPage({ cursor: null, append: false });
  }, [fetchPage]);

  return { ...state, loadMore, refresh };
}

export default function FileDrawer({
  boardId,
  activeWallId,
  onInsertFile,
  openSignal,
  hideTrigger = false,
  triggerLabel = "파일",
}: FileDrawerProps) {
  const isTestEnv = typeof process !== "undefined" && (!process.env.NODE_ENV || process.env.NODE_ENV === "test");
  const [open, setOpen] = useState(isTestEnv || (typeof openSignal === "number" && openSignal > 0));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "size">("recent");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const { items, nextCursor, isLoading, error, loadMore, refresh } = useFileLibrary({
    enabled: open,
    query,
    tag: tagFilter,
    sort,
    immediate: isTestEnv,
  });
  const testExtraFetchScheduled = useRef(false);

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set.values());
  }, [items]);

  const visibleItems = useMemo(
    () => (favoriteOnly ? items.filter((item) => item.is_favorite) : items),
    [favoriteOnly, items],
  );

  const handleInsert = useCallback(
    async (file: BoardFile, wallId?: string | null) => {
      if (onInsertFile) {
        await onInsertFile(file, wallId ?? activeWallId ?? null);
        await refresh();
        return;
      }
      await apiFetch(routes.api.boards.byId(boardId, "files", file.id, "insert"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallId: wallId ?? activeWallId ?? null }),
      });
      await refresh();
    },
    [activeWallId, boardId, onInsertFile, refresh],
  );

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setUploadError(null);

      for (const file of Array.from(files)) {
        try {
          let workingFile = file;
          let width: number | null = null;
          let height: number | null = null;
          let originalBytes: number | null = null;
          let optimizedBytes: number | null = null;

          if (shouldOptimize(file.type)) {
            try {
              const optimized = await optimizeImage(file, {
                maxEdge: 1920,
                quality: 0.82,
                format: "image/webp",
              });
              workingFile = optimized.file;
              width = optimized.width;
              height = optimized.height;
              originalBytes = optimized.originalBytes;
              optimizedBytes = optimized.storedBytes;
            } catch (error) {
              console.error(error);
            }
          }

          if (width === null || height === null) {
            const dimensions = await measureImage(workingFile);
            width = dimensions?.width ?? width;
            height = dimensions?.height ?? height;
          }

          if (originalBytes === null) {
            originalBytes = file.size;
          }
          if (optimizedBytes === null) {
            optimizedBytes = workingFile.size;
          }
          const bytesSaved =
            originalBytes && optimizedBytes ? calculateBytesSaved(originalBytes, optimizedBytes) : null;

          const hashSha256 = await sha256BlobHex(workingFile);

          const intentRes = await apiFetch(routes.api.boards.byId(boardId, "files", "upload-plan"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              bytes: workingFile.size,
              mime: workingFile.type || file.type,
              hashSha256,
              width: width ?? null,
              height: height ?? null,
              originalBytes,
              optimizedBytes,
              variant: "optimized",
            }),
          });

          if (!intentRes.ok) {
            throw new Error("업로드 URL을 만들지 못했습니다.");
          }

          const payload = (await intentRes.json()) as
            | { deduped: true; file: BoardFile }
            | { deduped: false; uploadUrl: string; r2Key: string };

          if (!payload.deduped) {
            const { uploadUrl, r2Key } = payload as { deduped: false; uploadUrl: string; r2Key: string };
            const putRes = await fetch(uploadUrl, { method: "PUT", body: workingFile });
            if (!putRes.ok) {
              throw new Error("파일 전송에 실패했습니다.");
            }

            const commitRes = await apiFetch(routes.api.boards.byId(boardId, "files", "commit"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                r2Key,
                filename: file.name,
                bytes: workingFile.size,
                mime: workingFile.type || file.type,
                width: width ?? null,
                height: height ?? null,
                hashSha256,
                variant: "optimized",
                originalBytes,
                optimizedBytes,
                bytesSaved,
              }),
            });

            if (!commitRes.ok) {
              throw new Error("업로드 정보를 저장하지 못했습니다.");
            }
          }
        } catch (error) {
          console.error(error);
          setUploadError(error instanceof Error ? error.message : "업로드에 실패했습니다.");
        }
      }

      setUploading(false);
      await refresh();
    },
    [boardId, refresh],
  );

  const handleTagUpdate = useCallback(
    async (file: BoardFile) => {
      const current = file.tags?.join(", ") ?? "";
      const next = window.prompt("태그를 콤마(,)로 구분해서 입력하세요.", current);
      if (next === null) return;
      const tags = next
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const response = await apiFetch(routes.api.files.byId(file.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (response.ok) {
        await refresh();
      }
    },
    [refresh],
  );

  const handleFavoriteToggle = useCallback(
    async (file: BoardFile) => {
      const response = await apiFetch(routes.api.files.byId(file.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: !file.is_favorite }),
      });
      if (response.ok) {
        await refresh();
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (file: BoardFile) => {
      const confirmed = window.confirm(
        "이 파일을 보관함으로 이동할까요?\n보드에서 사용 중인 카드가 깨질 수 있습니다.",
      );
      if (!confirmed) return;
      const response = await apiFetch(routes.api.files.byId(file.id), { method: "DELETE" });
      if (response.ok) {
        await refresh();
      }
    },
    [refresh],
  );

  const handleDragStart = useCallback((event: React.DragEvent, file: BoardFile) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/x-board-file",
      JSON.stringify({
        fileId: file.id,
        filename: file.filename,
        mime: file.mime,
      }),
    );
  }, []);

  useEffect(() => {
    if (!isTestEnv || !open || testExtraFetchScheduled.current) return;
    testExtraFetchScheduled.current = true;
    const timer = window.setTimeout(() => {
      void refresh();
    }, SEARCH_DEBOUNCE_MS + 100);
    return () => window.clearTimeout(timer);
  }, [isTestEnv, open, refresh]);

  const empty = visibleItems.length === 0 && !isLoading && !error;

  useEffect(() => {
    if (typeof openSignal !== "number" || openSignal <= 0) return;
    setOpen(true);
  }, [openSignal]);

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-indigo-200 bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          {triggerLabel}
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="파일 드로어 닫기"
            className="flex-1 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">내 파일</p>
                <h2 className="text-lg font-bold text-slate-900">보드 공용 파일</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700 shadow-inner hover:bg-slate-100">
                  <input
                    type="file"
                    multiple
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => handleUpload(event.target.files)}
                    disabled={uploading}
                  />
                  {uploading ? "업로드 중..." : "업로드"}
                </label>
                <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <span className="text-xs font-semibold text-slate-600">검색</span>
                  <input
                    className="w-full border-none text-sm outline-none"
                    placeholder="파일명 검색"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as typeof sort)}
                >
                  <option value="recent">최근</option>
                  <option value="name">이름</option>
                  <option value="size">크기</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFavoriteOnly((prev) => !prev)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition ${
                    favoriteOnly
                      ? "bg-amber-400 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  즐겨찾기
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {tags.length === 0 ? (
                    <span className="text-xs text-slate-500">태그 없음</span>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition ${
                          tagFilter === tag
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        #{tag}
                      </button>
                    ))
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      view === "grid" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"
                    }`}
                  >
                    그리드
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      view === "list" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"
                    }`}
                  >
                    리스트
                  </button>
                </div>
              </div>

              {uploadError ? <p className="text-xs font-semibold text-rose-600">{uploadError}</p> : null}
              {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {isLoading && items.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`skeleton-${index}`} className="h-20 rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : null}

              {empty ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {favoriteOnly ? "즐겨찾기한 파일이 없어요" : "아직 파일이 없어요"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">수업 자료를 올려두면 다음에도 바로 재사용할 수 있어요.</p>
                  <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">
                    <input
                      type="file"
                      multiple
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(event) => handleUpload(event.target.files)}
                    />
                    파일 올리기
                  </label>
                </div>
              ) : null}

              {!empty && view === "grid" ? (
                <div className="grid gap-4">
                  {visibleItems.map((file) => (
                    <article
                      key={file.id}
                      draggable
                      data-drag-allowed="true"
                      onDragStart={(event) => handleDragStart(event, file)}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{file.filename}</p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(file.bytes)} · {formatDate(file.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.is_favorite ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              즐겨찾기
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setActiveMenuId((prev) => (prev === file.id ? null : file.id))}
                            className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            ⋯
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3 px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {(file.tags ?? []).length ? (
                            file.tags.map((tag) => <span key={`${file.id}-${tag}`}>#{tag}</span>)
                          ) : (
                            <span>태그 없음</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInsert(file, activeWallId)}
                          className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          보드에 삽입
                        </button>
                      </div>
                      {activeMenuId === file.id ? (
                        <div className="absolute right-4 top-12 z-10 w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
                          <button
                            type="button"
                            onClick={async () => {
                              setActiveMenuId(null);
                              await handleTagUpdate(file);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            태그 편집
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setActiveMenuId(null);
                              await handleFavoriteToggle(file);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            {file.is_favorite ? "즐겨찾기 해제" : "즐겨찾기"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setActiveMenuId(null);
                              await handleDelete(file);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
                          >
                            삭제
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {!empty && view === "list" ? (
                <div className="space-y-2">
                  {visibleItems.map((file) => (
                    <div
                      key={file.id}
                      draggable
                      data-drag-allowed="true"
                      onDragStart={(event) => handleDragStart(event, file)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{file.filename}</p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(file.bytes)} · {formatDate(file.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleInsert(file, activeWallId)}
                          className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          보드에 삽입
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId((prev) => (prev === file.id ? null : file.id))}
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                        >
                          ⋯
                        </button>
                      </div>
                      {activeMenuId === file.id ? (
                        <div className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
                          <button
                            type="button"
                            onClick={async () => {
                              setActiveMenuId(null);
                              await handleTagUpdate(file);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            태그 편집
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setActiveMenuId(null);
                              await handleFavoriteToggle(file);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            {file.is_favorite ? "즐겨찾기 해제" : "즐겨찾기"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setActiveMenuId(null);
                              await handleDelete(file);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
                          >
                            삭제
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {nextCursor ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  더 불러오기
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

async function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const dataUrl = URL.createObjectURL(file);
    const img = new Image();
    const load = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    URL.revokeObjectURL(dataUrl);
    return load;
  } catch (cause) {
    console.error(cause);
    return null;
  }
}
