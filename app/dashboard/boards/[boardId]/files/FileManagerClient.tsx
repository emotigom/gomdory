"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { BoardFile } from "@/lib/data/boardFiles";
import { sha256BlobHex } from "@/lib/crypto/sha256";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { optimizeImage } from "@/lib/media/optimizeImage";
import { calculateBytesSaved, shouldOptimize } from "@/lib/media/optimizationPolicy";

import { uploadReducer, type UploadItem, type UploadState } from "./uploadReducer";

type FileManagerClientProps = {
  boardId: string;
  initialFiles: BoardFile[];
};

function buildTagPalette(files: BoardFile[]): string[] {
  const tags = new Set<string>();
  for (const file of files) {
    (file.tags ?? []).forEach((tag) => tags.add(tag));
  }
  return Array.from(tags.values());
}

export function FileManagerClient({ boardId, initialFiles }: FileManagerClientProps) {
  const [files, setFiles] = useState<BoardFile[]>(initialFiles);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadState, dispatch] = useReducer(uploadReducer, { items: [] } as UploadState);
  const [optimizeEnabled, setOptimizeEnabled] = useState(true);
  const [maxDimension, setMaxDimension] = useState(1920);
  const [format, setFormat] = useState<"image/webp" | "image/jpeg">("image/webp");
  const [quality, setQuality] = useState(0.82);
  const [dedupMessage, setDedupMessage] = useState<string | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const response = await fetch(apiV1Path(`dashboard/boards/${boardId}/files`), { cache: "no-store" });
      if (!response.ok || !mountedRef.current) return;
      const payload = (await response.json()) as { files?: BoardFile[] };
      if (payload.files && mountedRef.current) setFiles(payload.files);
    } catch (cause) {
      console.error(cause);
    }
  }, [boardId]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("gomdory:dashboard");
    } catch {
      return;
    }

    bcRef.current = bc;
    const handler = () => void refreshFiles();
    bc.addEventListener("message", handler);
    return () => {
      bc?.removeEventListener("message", handler);
      bc?.close();
      if (bcRef.current === bc) {
        bcRef.current = null;
      }
    };
  }, [refreshFiles]);

  const handleUpload = useCallback(
    async (item: UploadItem) => {
      dispatch({ type: "start", id: item.id });
      setError(null);
      setDedupMessage(null);
      try {
        let workingFile = item.file;
        let width: number | null = null;
        let height: number | null = null;
        let originalBytes: number | null = null;
        let optimizedBytes: number | null = null;

        if (optimizeEnabled && shouldOptimize(workingFile.type)) {
          try {
            const optimized = await optimizeImage(item.file, {
              maxEdge: maxDimension,
              quality,
              format,
            });
            workingFile = optimized.file;
            width = optimized.width;
            height = optimized.height;
            originalBytes = optimized.originalBytes;
            optimizedBytes = optimized.storedBytes;
          } catch (optError) {
            console.error(optError);
          }
        }

        if (width === null || height === null) {
          const dimensions = await measureImage(workingFile);
          width = dimensions?.width ?? width;
          height = dimensions?.height ?? height;
        }

        if (originalBytes === null) {
          originalBytes = item.file.size;
        }
        if (optimizedBytes === null) {
          optimizedBytes = workingFile.size;
        }
        const bytesSaved = originalBytes && optimizedBytes ? calculateBytesSaved(originalBytes, optimizedBytes) : null;

        dispatch({ type: "progress", id: item.id, progress: 5 });
        const hashSha256 = await sha256BlobHex(workingFile);

        const intentRes = await fetch(apiV1Path(`boards/${boardId}/files/upload-plan`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.file.name,
            bytes: workingFile.size,
            mime: workingFile.type || item.file.type,
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

        if (payload.deduped) {
          const existing = (payload as { deduped: true; file: BoardFile }).file;
          setFiles((prev) => [existing, ...prev]);
          dispatch({
            type: "success",
            id: item.id,
            file: {
              id: existing.id,
              bytesSaved: existing.bytes_saved ?? bytesSaved ?? 0,
              optimizedBytes: existing.optimized_bytes ?? existing.bytes,
              originalBytes: existing.original_bytes ?? originalBytes ?? existing.bytes,
              deduped: true,
            },
          });
          setDedupMessage("중복 파일 감지: 업로드가 생략되고 기존 파일이 재사용되었습니다.");
          bcRef.current?.postMessage({ type: "board_files_updated", boardId });
          publishDashboardInvalidate({
            type: "boards_changed",
            reason: "updated",
            ts: Date.now(),
          });
          return;
        }

        const { uploadUrl, r2Key } = payload as { deduped: false; uploadUrl: string; r2Key: string };
        dispatch({ type: "progress", id: item.id, progress: 15 });

        const putRes = await fetch(uploadUrl, { method: "PUT", body: workingFile });
        if (!putRes.ok) {
          throw new Error("파일 전송에 실패했습니다.");
        }

        dispatch({ type: "progress", id: item.id, progress: 90 });

        const commitRes = await fetch(apiV1Path(`boards/${boardId}/files/commit`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            r2Key,
            filename: item.file.name,
            bytes: workingFile.size,
            mime: workingFile.type || item.file.type,
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

        const commitPayload = (await commitRes.json()) as { file: BoardFile };
        const newFile = commitPayload.file;
        setFiles((prev) => [newFile, ...prev]);
        dispatch({
          type: "success",
          id: item.id,
          file: {
            id: newFile.id,
            bytesSaved: newFile.bytes_saved ?? bytesSaved ?? 0,
            optimizedBytes: newFile.optimized_bytes ?? optimizedBytes ?? newFile.bytes,
            originalBytes: newFile.original_bytes ?? originalBytes ?? newFile.bytes,
          },
        });
        bcRef.current?.postMessage({ type: "board_files_updated", boardId });
        publishDashboardInvalidate({
          type: "boards_changed",
          reason: "updated",
          ts: Date.now(),
        });
      } catch (cause) {
        console.error(cause);
        dispatch({ type: "failure", id: item.id, error: cause instanceof Error ? cause.message : "업로드 실패" });
        setError(cause instanceof Error ? cause.message : "업로드에 실패했습니다.");
      }
    },
    [boardId, format, maxDimension, optimizeEnabled, quality],
  );

  useEffect(() => {
    const pending = uploadState.items.find((item) => item.status === "queued");
    if (!pending) return;
    void handleUpload(pending);
  }, [handleUpload, uploadState.items]);

  function handleFiles(filesToAdd: FileList | null) {
    if (!filesToAdd || filesToAdd.length === 0) return;
    const items: UploadItem[] = Array.from(filesToAdd).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      status: "queued",
      progress: 0,
    }));
    dispatch({ type: "enqueue", items });
  }

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesQuery = file.filename.toLowerCase().includes(query.toLowerCase());
      const matchesType =
        filterType === "all"
          ? true
          : filterType === "image"
            ? (file.mime ?? "").startsWith("image/")
            : filterType === "doc"
              ? (file.mime ?? "").startsWith("application/") || (file.mime ?? "").startsWith("text/")
              : true;
      const matchesTag = tagFilter ? file.tags.includes(tagFilter) : true;
      return matchesQuery && matchesType && matchesTag;
    });
  }, [files, query, filterType, tagFilter]);

  async function insertToBoard(file: BoardFile) {
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/files/${file.id}/insert`), { method: "POST" });
      if (!response.ok) {
        throw new Error("보드에 삽입하지 못했습니다.");
      }
      bcRef.current?.postMessage({ type: "board_files_insert", boardId });
    } catch (cause) {
      console.error(cause);
      setError(cause instanceof Error ? cause.message : "보드에 삽입하지 못했습니다.");
    }
  }

  async function copyLink(file: BoardFile) {
    try {
      const link = `${window.location.origin}${apiV1Path(`boards/${boardId}/files/${file.id}/download`)}`;
      await navigator.clipboard.writeText(link);
    } catch (cause) {
      console.error(cause);
    }
  }

  const tagPalette = useMemo(() => buildTagPalette(files), [files]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700 shadow-inner hover:bg-slate-100">
            <input
              type="file"
              multiple
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => handleFiles(event.target.files)}
            />
            드래그&드롭 또는 클릭해서 업로드
          </label>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-semibold text-slate-600">검색</span>
            <input
              className="border-none text-sm outline-none"
              placeholder="파일명 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="image">이미지</option>
            <option value="doc">문서/기타</option>
          </select>
          <div className="flex items-center gap-2">
            {tagPalette.length === 0 ? (
              <span className="text-xs text-slate-500">태그 없음</span>
            ) : (
              tagPalette.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition ${tagFilter === tag ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
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
              className={`rounded-full px-3 py-2 text-sm font-semibold ${view === "grid" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              그리드
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${view === "list" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              리스트
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50/80 px-4 py-3 text-xs text-slate-700">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={optimizeEnabled}
              onChange={(event) => setOptimizeEnabled(event.target.checked)}
            />
            업로드 시 이미지 최적화 (Pro 기본 ON)
          </label>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">최대 해상도</span>
            <select
              value={maxDimension}
              onChange={(event) => setMaxDimension(Number(event.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
            >
              <option value={1280}>1280px</option>
              <option value={1920}>1920px</option>
              <option value={2560}>2560px</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">포맷</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as typeof format)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
            >
              <option value="image/webp">WebP</option>
              <option value="image/jpeg">JPEG</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">품질</span>
            <input
              type="range"
              min={0.7}
              max={0.9}
              step={0.01}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
            <span className="font-semibold text-slate-600">{Math.round((quality ?? 0.82) * 100)}%</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-700">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold">실측 절감 표시</span>
            <span>업로드 시 최적화/중복 절감을 바로 계산합니다.</span>
          </div>
        </div>
        {dedupMessage ? <p className="mt-2 text-sm font-semibold text-emerald-700">{dedupMessage}</p> : null}
      </div>

      {uploadState.items.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">업로드 진행</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uploadState.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.file.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-600">
                    {item.file.type.startsWith("image") ? "IMG" : "FILE"}
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${item.status === "failed" ? "bg-rose-500" : item.status === "success" ? "bg-emerald-500" : "bg-indigo-500"}`}
                      style={{ width: `${Math.min(100, item.progress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {item.status === "success" && item.deduped ? "중복 감지" : item.status}
                  </p>
                  {item.status === "success" ? (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      {item.deduped ? "업로드 생략, 기존 파일 재사용" : "절감"}
                      {" "}
                      {item.bytesSaved != null ? formatBytes(Math.max(0, item.bytesSaved)) : "-"}
                      {item.originalBytes && item.bytesSaved != null && item.originalBytes > 0
                        ? ` (${Math.round((item.bytesSaved / item.originalBytes) * 100)}%)`
                        : null}
                    </p>
                  ) : null}
                </div>
                {item.status === "failed" ? (
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm"
                    onClick={() => dispatch({ type: "retry", id: item.id })}
                  >
                    재시도
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFiles.map((file) => (
            <article key={file.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="aspect-video w-full bg-slate-100">
                {file.mime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={apiV1Path(`boards/${boardId}/files/${file.id}/download`)}
                    alt={file.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">{file.mime ?? "파일"}</div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-xs text-slate-500">{formatBytes(file.bytes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(file)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    링크 복사
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {(file.tags ?? []).length ? file.tags.map((tag) => <span key={tag}>#{tag}</span>) : <span>태그 없음</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => insertToBoard(file)}
                    className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    보드에 삽입
                  </button>
                  <a
                    href={apiV1Path(`boards/${boardId}/files/${file.id}/download`)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    열기
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">파일명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">타입</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">크기</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{file.filename}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{file.mime ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatBytes(file.bytes)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => insertToBoard(file)}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        보드에 삽입
                      </button>
                      <button
                        type="button"
                        onClick={() => copyLink(file)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        링크 복사
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
