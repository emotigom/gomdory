"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { routes } from "@/lib/standards/routes";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { BoardFile } from "@/lib/data/boardFiles";
import { apiFetch } from "@/lib/http/apiFetch";

import { optimizeImage } from "@/lib/media/optimizeImage";
import { hashFile } from "@/lib/media/hashFile";
import { calculateBytesSaved, shouldOptimize } from "@/lib/media/optimizationPolicy";
import { publishDashboardInvalidate, subscribeDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { useVisibilityRefetch } from "@/lib/dashboard/useVisibilityRefetch";
import { normalizeFileTagValue, FILE_TAG_LIMIT } from "@/lib/files/normalizeTags";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";
import { pushDashboardToast, useDashboardToasts } from "@/app/dashboard/useDashboardToast";

import { FileUploader, type FileUploaderHandle } from "@/components/dashboard/FileUploader";
import { cn } from "@/app/_components/uiTokens";

import styles from "./FileLibraryClient.module.css";

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_LIMIT = 24;
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_HASH_BYTES = 30 * 1024 * 1024;
const FORCE_OPTIMIZE_BYTES = 6 * 1024 * 1024;
const MAX_OPTIMIZE_DIM = 1920;
const TAG_LIMIT = FILE_TAG_LIMIT;

const SAFE_PREVIEW_PREFIXES = ["image/"];
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "video/", "application/vnd", "text/"];

type BoardLite = {
  boardId: string;
  title: string;
  updatedAt: string | null;
  shareCode?: string | null;
};

type UploadStatus =
  | "queued"
  | "optimizing"
  | "uploading"
  | "optimized"
  | "deduped"
  | "completed"
  | "failed";

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress?: number | null;
  bytesSaved?: number | null;
  bytesOriginal?: number | null;
  bytesStored?: number | null;
  optimized?: boolean;
  dedupReused?: boolean;
  error?: string | null;
  retryCount: number;
  warning?: string | null;
};

type FileView = "grid" | "list";

type DrawerMode = "details" | "insert";

type DeleteRequest = {
  fileIds: string[];
  filenames: string[];
  opener: HTMLElement | null;
};

type FileLibraryClientProps = {
  embedded?: boolean;
  initialBoardId?: string | null;
};

function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target as HTMLElement).tagName) return false;
  const element = target as HTMLElement;
  const tag = element.tagName;
  return element.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function FileLibraryClient({ embedded = false, initialBoardId = null }: FileLibraryClientProps) {
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [view, setView] = useState<FileView>("list");
  const [boardFilter, setBoardFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"any" | "image" | "pdf" | "audio" | "video">("any");
  const [sort, setSort] = useState<"recent" | "size" | "name">("recent");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("details");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [optimizeEnabled, setOptimizeEnabled] = useState(true);
  const [boardOptions, setBoardOptions] = useState<BoardLite[]>([]);
  const [boardSearch, setBoardSearch] = useState("");
  const [tagsSuggest, setTagsSuggest] = useState<string[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(initialBoardId);
  const [insertBoardId, setInsertBoardId] = useState<string | null>(null);
  const [insertSuccess, setInsertSuccess] = useState<BoardLite | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const toasts = useDashboardToasts();

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const uploaderRef = useRef<FileUploaderHandle | null>(null);
  const uploadBoardSelectRef = useRef<HTMLSelectElement | null>(null);
  const libraryFocusRef = useRef<HTMLElement | null>(null);
  const inFlightUploads = useRef(0);

  const activeFile = useMemo(() => files.find((file) => file.id === activeFileId) ?? null, [files, activeFileId]);
  const selectedUploadBoard = useMemo(
    () => boardOptions.find((board) => board.boardId === selectedBoardId) ?? null,
    [boardOptions, selectedBoardId],
  );
  const canUpload = selectedUploadBoard !== null;

  const { requestRefetch } = useVisibilityRefetch(() => {
    void fetchFiles({ reset: true });
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (initialBoardId && !selectedBoardId) {
      setSelectedBoardId(initialBoardId);
    }
  }, [initialBoardId, selectedBoardId]);

  useEffect(() => {
    if (initialBoardId && !insertBoardId) {
      setInsertBoardId(initialBoardId);
    }
  }, [initialBoardId, insertBoardId]);

  const fetchFiles = useCallback(
    async ({ reset }: { reset: boolean }) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (tagFilter) params.set("tag", tagFilter);
        if (boardFilter) params.set("boardId", boardFilter);
        if (typeFilter !== "any") params.set("type", typeFilter);
        params.set("sort", sort);
        params.set("limit", `${PAGE_LIMIT}`);
        if (!reset && nextCursor) params.set("cursor", nextCursor);
        const response = await apiFetch(apiV1Path(`files?${params.toString()}`), { cache: "no-store" });
        const payload = (await response.json()) as {
          ok?: boolean;
          items?: BoardFile[];
          nextCursor?: string | null;
          error?: string;
        };
        if (!response.ok || payload.ok === false) {
          setFiles((prev) => (reset ? [] : prev));
          setNextCursor(null);
          setError(payload.error ?? "파일을 불러오지 못했습니다.");
          return;
        }
        setFiles((prev) => (reset ? payload.items ?? [] : [...prev, ...(payload.items ?? [])]));
        setNextCursor(payload.nextCursor ?? null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "파일을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [boardFilter, debouncedQuery, nextCursor, sort, tagFilter, typeFilter],
  );

  useEffect(() => {
    void fetchFiles({ reset: true });
  }, [fetchFiles]);

  useEffect(() => {
    const unsubscribe = subscribeDashboardInvalidate((event) => {
      if (event.type !== "files_changed" && event.type !== "storage_changed") return;
      requestRefetch();
    });
    return unsubscribe;
  }, [requestRefetch]);

  useEffect(() => {
    const handleHotkeys = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        if (canUpload) {
          uploaderRef.current?.open();
        } else {
          uploadBoardSelectRef.current?.focus();
          pushDashboardToast({
            title: "보드를 먼저 골라주세요",
            description: "파일은 선택한 보드에 연결됩니다.",
          });
        }
      }
      if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        setSelectionMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleHotkeys);
    return () => window.removeEventListener("keydown", handleHotkeys);
  }, [canUpload]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  const fetchTagsSuggest = useCallback(async () => {
    try {
      const response = await apiFetch(apiV1Path("files/tags/suggest"), { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; tags?: string[] };
      if (!response.ok || payload.ok === false) return;
      setTagsSuggest(payload.tags?.slice(0, TAG_LIMIT) ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchTagsSuggest();
  }, [fetchTagsSuggest]);

  const fetchBoardOptions = useCallback(async () => {
    try {
      const response = await apiFetch(apiV1Path("dashboard/boards?lite=1"), { cache: "no-store" });
      const payload = (await response.json()) as { boards?: BoardLite[] };
      const boards = payload.boards ?? [];
      setBoardOptions(boards);
      setSelectedBoardId((prev) =>
        prev && boards.some((board) => board.boardId === prev) ? prev : boards[0]?.boardId ?? null,
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchBoardOptions();
  }, [fetchBoardOptions]);

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const openDrawer = useCallback(
    (fileId: string, mode: DrawerMode = "details") => {
      setActiveFileId(fileId);
      setDrawerMode(mode);
      setDrawerOpen(true);
      setInsertSuccess(null);
    },
    [],
  );

  const updateFilesOptimistic = useCallback(
    async (updater: (prev: BoardFile[]) => BoardFile[], action: () => Promise<void>, fallbackMessage: string) => {
      let snapshot: BoardFile[] = [];
      setFiles((prev) => {
        snapshot = prev;
        return updater(prev);
      });
      try {
        await action();
      } catch (actionError) {
        setFiles(snapshot);
        setError(actionError instanceof Error ? actionError.message : fallbackMessage);
      }
    },
    [],
  );

  const handleTagUpdate = useCallback(
    async (fileId: string, tags: string[]) => {
      await updateFilesOptimistic(
        (prev) => prev.map((file) => (file.id === fileId ? { ...file, tags } : file)),
        async () => {
          const existing = files.find((file) => file.id === fileId)?.tags ?? [];
          const add = tags.filter((tag) => !existing.includes(tag));
          const remove = existing.filter((tag) => !tags.includes(tag));
          const response = await apiFetch(apiV1Path(`files/${fileId}/tags`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ add, remove }),
          });
          if (!response.ok) {
            throw new Error("태그를 저장하지 못했습니다.");
          }
          publishDashboardInvalidate({
            type: "files_changed",
            reason: "updated",
            ts: Date.now(),
          });
        },
        "태그를 저장하지 못했습니다.",
      );
    },
    [files, updateFilesOptimistic],
  );

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      await updateFilesOptimistic(
        (prev) => prev.filter((file) => file.id !== fileId),
        async () => {
          const response = await apiFetch(apiV1Path(`files`), {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId }),
          });
          if (!response.ok) {
            throw new Error("파일을 영구 삭제하지 못했습니다.");
          }
          publishDashboardInvalidate({
            type: "files_changed",
            reason: "deleted",
            ts: Date.now(),
          });
          publishDashboardInvalidate({
            type: "storage_changed",
            reason: "deleted",
            ts: Date.now(),
          });
        },
        "파일을 영구 삭제하지 못했습니다.",
      );
    },
    [updateFilesOptimistic],
  );

  const handleBulkDelete = useCallback(async (fileIds: string[]) => {
    if (fileIds.length === 0) return;
    const fileIdSet = new Set(fileIds);
    await updateFilesOptimistic(
      (prev) => prev.filter((file) => !fileIdSet.has(file.id)),
      async () => {
        await Promise.all(
          fileIds.map(async (fileId) => {
            const response = await apiFetch(apiV1Path(`files`), {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileId }),
            });
            if (!response.ok) {
              throw new Error("파일을 영구 삭제하지 못했습니다.");
            }
          }),
        );
        publishDashboardInvalidate({
          type: "files_changed",
          reason: "deleted",
          ts: Date.now(),
        });
        publishDashboardInvalidate({
          type: "storage_changed",
          reason: "deleted",
          ts: Date.now(),
        });
        setSelectedIds(new Set());
      },
      "파일을 영구 삭제하지 못했습니다.",
    );
  }, [updateFilesOptimistic]);

  const requestFileDelete = useCallback(
    (fileIds: string[], opener: HTMLElement | null) => {
      const uniqueIds = Array.from(new Set(fileIds));
      if (uniqueIds.length === 0) return;
      const idSet = new Set(uniqueIds);
      setDeleteRequest({
        fileIds: uniqueIds,
        filenames: files.filter((file) => idSet.has(file.id)).map((file) => file.filename),
        opener,
      });
    },
    [files],
  );

  const confirmFileDelete = useCallback(async () => {
    if (!deleteRequest || deletePending) return;
    const [firstFileId] = deleteRequest.fileIds;
    setDeletePending(true);
    try {
      if (deleteRequest.fileIds.length === 1 && firstFileId) {
        await handleDeleteFile(firstFileId);
      } else {
        await handleBulkDelete(deleteRequest.fileIds);
      }
      setDeleteRequest(null);
    } finally {
      setDeletePending(false);
    }
  }, [deletePending, deleteRequest, handleBulkDelete, handleDeleteFile]);

  const handleInsertFile = useCallback(
    async (fileId: string, boardId: string) => {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/files/attach`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, mode: "attach" }),
      });
      if (!response.ok) {
        throw new Error("보드에 넣지 못했습니다.");
      }
      const boardMatch = boardOptions.find((board) => board.boardId === boardId) ?? null;
      setInsertSuccess(boardMatch);
      pushDashboardToast({ title: "보드에 추가됨", description: boardMatch?.title ?? "선택한 보드" });
      publishDashboardInvalidate({
        type: "files_changed",
        reason: "updated",
        ts: Date.now(),
      });
    },
    [boardOptions],
  );

  const filteredBoards = useMemo(() => {
    const normalized = boardSearch.trim().toLowerCase();
    const list = normalized
      ? boardOptions.filter((board) => board.title.toLowerCase().includes(normalized))
      : [...boardOptions];
    return list.slice(0, 12);
  }, [boardOptions, boardSearch]);

  const recentBoards = useMemo(() => {
    const list = [...boardOptions];
    return list
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
      .slice(0, 6);
  }, [boardOptions]);

  const uploadQueueVisible = uploadQueue.length > 0;

  const enqueueFiles = useCallback((fileList: FileList | File[]) => {
    const items = Array.from(fileList).map((file) => {
      if (file.size > MAX_FILE_BYTES) {
        return {
          id: crypto.randomUUID(),
          file,
          status: "failed" as UploadStatus,
          progress: 0,
          retryCount: 0,
          error: "파일 크기 제한(200MB)을 초과했습니다.",
        };
      }
      const warning =
        file.type && !ALLOWED_MIME_PREFIXES.some((prefix) => file.type.toLowerCase().startsWith(prefix))
          ? "주의: 지원하지 않는 파일 형식일 수 있습니다."
          : null;
      return {
        id: crypto.randomUUID(),
        file,
        status: "queued" as UploadStatus,
        progress: 0,
        retryCount: 0,
        warning,
      };
    });
    setUploadQueue((prev) => [...items, ...prev]);
  }, []);

  const updateUploadItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploadQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeUploadItem = useCallback((id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleDropFiles = useCallback(
    (filesToAdd: FileList | File[]) => {
      if (!canUpload) {
        pushDashboardToast({
          title: "보드를 먼저 골라주세요",
          description: "파일은 선택한 보드에 연결됩니다.",
        });
        return;
      }
      enqueueFiles(filesToAdd);
    },
    [canUpload, enqueueFiles],
  );

  const uploadWithProgress = useCallback(
    async (url: string, file: File, headers: Record<string, string> | null, onProgress: (value: number) => void) => {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("upload_failed"));
          }
        };
        xhr.onerror = () => reject(new Error("upload_failed"));
        xhr.send(file);
      });
    },
    [],
  );

  const processUploadQueue = useCallback(async () => {
    if (inFlightUploads.current >= MAX_CONCURRENT_UPLOADS) return;

    const nextItem = uploadQueue.find((item) => item.status === "queued");
    if (!nextItem) return;

    if (!selectedBoardId) {
      updateUploadItem(nextItem.id, {
        status: "failed",
        error: "업로드할 보드를 선택해주세요.",
      });
      return;
    }

    inFlightUploads.current += 1;
    updateUploadItem(nextItem.id, { status: "optimizing", error: null, progress: 0 });
    let shouldAutoRemove = true;

    try {
      const { file } = nextItem;
      let workingFile = file;
      let width: number | null = null;
      let height: number | null = null;
      let originalBytes: number | null = null;
      let optimizedBytes: number | null = null;

      const shouldOptimizeFile =
        shouldOptimize(file.type) && (optimizeEnabled || file.size >= FORCE_OPTIMIZE_BYTES);

      let optimizationMeta:
        | {
            method: "canvas";
            format: string;
            quality: number;
            maxDim: number;
            errorReason?: string;
          }
        | null = null;

      if (shouldOptimizeFile) {
        try {
          const optimized = await optimizeImage(file, {
            maxEdge: MAX_OPTIMIZE_DIM,
            quality: 0.82,
            format: "image/webp",
          });
          workingFile = optimized.file;
          width = optimized.width;
          height = optimized.height;
          originalBytes = optimized.originalBytes;
          optimizedBytes = optimized.optimizedBytes ?? optimized.storedBytes;
          const format =
            optimized.format === "jpeg"
              ? "image/jpeg"
              : optimized.format === "png"
                ? "image/png"
                : "image/webp";
          optimizationMeta = {
            method: "canvas",
            format,
            quality: 0.82,
            maxDim: MAX_OPTIMIZE_DIM,
          };
        } catch (optimizeError) {
          console.error(optimizeError);
          optimizationMeta = {
            method: "canvas",
            format: file.type || "image/unknown",
            quality: 0.82,
            maxDim: MAX_OPTIMIZE_DIM,
            errorReason: "optimize_failed",
          };
        }
      }

      if (width === null || height === null) {
        const dimensions = await measureImage(workingFile);
        width = dimensions?.width ?? width;
        height = dimensions?.height ?? height;
      }

      originalBytes = originalBytes ?? file.size;
      optimizedBytes = optimizedBytes ?? workingFile.size;
      const bytesSaved = calculateBytesSaved(originalBytes ?? 0, optimizedBytes ?? 0);
      updateUploadItem(nextItem.id, {
        status: bytesSaved > 0 ? "optimized" : "uploading",
        bytesSaved,
      });

      const hashResult = await hashFile(workingFile, { maxBytes: MAX_HASH_BYTES });
      if (hashResult.skipped) {
        const skipNotice = "대용량 파일은 중복 감지가 제한될 수 있어요.";
        updateUploadItem(nextItem.id, {
          warning: nextItem.warning ? `${nextItem.warning} ${skipNotice}` : skipNotice,
        });
      }
      const hashSha256 = hashResult.sha256Hex;
      const optimizedFlag = bytesSaved > 0;

      updateUploadItem(nextItem.id, {
        bytesOriginal: originalBytes,
        bytesStored: optimizedBytes,
        optimized: optimizedFlag,
      });

      const runLegacyFlow = async () => {
        if (!hashSha256) {
          throw new Error("hash_unavailable");
        }
        const intentRes = await apiFetch(apiV1Path(`boards/${selectedBoardId}/files/upload-plan`), {
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
          throw new Error("업로드 준비에 실패했습니다.");
        }

        const payload = (await intentRes.json()) as
          | { deduped: true; file: BoardFile }
          | { deduped: false; uploadUrl: string; r2Key: string };

        if (payload.deduped) {
          setFiles((prev) => [payload.file, ...prev]);
          updateUploadItem(nextItem.id, { status: "deduped", dedupReused: true, progress: 100 });
          publishDashboardInvalidate({ type: "files_changed", reason: "updated", ts: Date.now() });
          pushDashboardToast({ title: "업로드 완료", description: file.name });
          return;
        }

        updateUploadItem(nextItem.id, { status: "uploading", progress: 0 });
        const uploadPayload = payload as { deduped: false; uploadUrl: string; r2Key: string };
        await uploadWithProgress(uploadPayload.uploadUrl, workingFile, null, (progress) => {
          updateUploadItem(nextItem.id, { progress });
        });
        updateUploadItem(nextItem.id, { progress: 100 });

        const commitRes = await apiFetch(apiV1Path(`boards/${selectedBoardId}/files/commit`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            r2Key: uploadPayload.r2Key,
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

        const commitPayload = (await commitRes.json()) as { file?: BoardFile };
        if (commitPayload.file) {
          setFiles((prev) => [commitPayload.file as BoardFile, ...prev]);
        }
      };

      try {
        const prepareRes = await apiFetch(apiV1Path("files/upload/prepare"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardId: selectedBoardId,
            filename: file.name,
            contentType: workingFile.type || file.type,
            sizeBytes: optimizedBytes,
            sha256: hashSha256,
            originalBytes,
            optimizedBytes,
            optimization: optimizationMeta,
          }),
        });

        if (!prepareRes.ok) {
          throw new Error("prepare_failed");
        }

        const preparePayload = (await prepareRes.json()) as
          | { ok: true; deduped: true; existingFile: BoardFile }
          | { ok: true; deduped?: false; upload: { r2Key: string; url: string; headers?: Record<string, string> } };

        if (!preparePayload.ok) {
          throw new Error("prepare_failed");
        }

        if ("deduped" in preparePayload && preparePayload.deduped) {
          setFiles((prev) => [preparePayload.existingFile, ...prev]);
          updateUploadItem(nextItem.id, { status: "deduped", dedupReused: true, progress: 100 });
          publishDashboardInvalidate({ type: "files_changed", reason: "updated", ts: Date.now() });
          pushDashboardToast({ title: "업로드 완료", description: file.name });
          return;
        }

        updateUploadItem(nextItem.id, { status: "uploading", progress: 0 });
        await uploadWithProgress(
          preparePayload.upload.url,
          workingFile,
          preparePayload.upload.headers ?? null,
          (progress) => {
            updateUploadItem(nextItem.id, { progress });
          },
        );
        updateUploadItem(nextItem.id, { progress: 100 });

        const completeRes = await apiFetch(apiV1Path("files/upload/commit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardId: selectedBoardId,
            r2Key: preparePayload.upload.r2Key,
            originalName: file.name,
            contentType: workingFile.type || file.type,
            sizeBytes: optimizedBytes,
            sha256: hashSha256,
            originalBytes,
            optimizedBytes,
            optimization: optimizationMeta,
          }),
        });

        if (!completeRes.ok) {
          throw new Error("complete_failed");
        }

        const completePayload = (await completeRes.json()) as { file?: BoardFile };
        if (completePayload.file) {
          setFiles((prev) => [completePayload.file as BoardFile, ...prev]);
        }
      } catch (error) {
        console.warn("[file-upload] v1 flow failed, falling back", error);
        if (!hashSha256) {
          throw error;
        }
        await runLegacyFlow();
      }

      updateUploadItem(nextItem.id, { status: "completed" });
      publishDashboardInvalidate({ type: "files_changed", reason: "uploaded", ts: Date.now() });
      publishDashboardInvalidate({ type: "storage_changed", reason: "uploaded", ts: Date.now() });
      pushDashboardToast({ title: "업로드 완료", description: file.name });
    } catch (uploadError) {
        updateUploadItem(nextItem.id, {
          status: "failed",
          error: uploadError instanceof Error ? uploadError.message : "업로드에 실패했습니다.",
        });
      pushDashboardToast({
        title: "업로드 실패",
        description: uploadError instanceof Error ? uploadError.message : "업로드에 실패했습니다.",
      });
      shouldAutoRemove = false;
    } finally {
      inFlightUploads.current -= 1;
      if (shouldAutoRemove) {
        window.setTimeout(() => {
          removeUploadItem(nextItem.id);
        }, 3000);
      }
    }
  }, [optimizeEnabled, removeUploadItem, selectedBoardId, updateUploadItem, uploadQueue, uploadWithProgress]);

  useEffect(() => {
    if (uploadQueue.some((item) => item.status === "queued") && inFlightUploads.current < MAX_CONCURRENT_UPLOADS) {
      void processUploadQueue();
    }
  }, [processUploadQueue, uploadQueue]);

  const retryUpload = useCallback(
    (item: UploadItem) => {
      if (item.retryCount >= 1) return;
      updateUploadItem(item.id, { status: "queued", error: null, retryCount: item.retryCount + 1 });
    },
    [updateUploadItem],
  );

  const tagChips = useMemo(() => {
    if (tagsSuggest.length > 0) return tagsSuggest;
    const set = new Set<string>();
    files.forEach((file) => file.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set.values()).slice(0, TAG_LIMIT);
  }, [files, tagsSuggest]);

  const handleUploadClick = useCallback(() => {
    if (!canUpload) {
      uploadBoardSelectRef.current?.focus();
      pushDashboardToast({
        title: "보드를 먼저 골라주세요",
        description: "파일은 선택한 보드에 연결됩니다.",
      });
      return;
    }
    uploaderRef.current?.open();
  }, [canUpload]);

  return (
    <div
      data-dashboard-files-client="workshop"
      className={cn(
        styles.workshop,
        "flex flex-col gap-6 pb-24",
        embedded ? "mx-auto max-w-none px-4 pt-6 sm:px-6" : "max-w-none",
      )}
    >
      <div
        className="fixed bottom-6 right-6 z-50 space-y-3"
        role="status"
        aria-live="polite"
        aria-atomic="false"
        data-dashboard-file-toasts
      >
        {toasts.map((toast) => (
          <div key={toast.id} className={cn(styles.toast, "rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg")}>
            <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
            {toast.description ? <p className="text-xs text-gray-600">{toast.description}</p> : null}
          </div>
        ))}
      </div>
      <section className={cn(styles.toolShelf, "dashboard-files-card rounded-3xl bg-white/80 px-5 py-5 shadow-sm backdrop-blur sm:px-6")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">SORT &amp; STORE</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-900">자료 정리대</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">찾기, 골라내기, 업로드를 여기서 시작하세요.</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="dashboard-files-card flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={optimizeEnabled}
                onChange={(event) => setOptimizeEnabled(event.target.checked)}
                className="dashboard-files-input accent-indigo-600"
              />
              <span className="flex flex-col text-left">
                <span className="text-xs font-black text-slate-700">사진 용량 줄이기</span>
                <span className={cn(styles.mobileFinePrint, "text-[11px] font-medium text-slate-500")}>화질을 살피며 가볍게 저장해요.</span>
                <span className={cn(styles.mobileFinePrint, "text-[11px] font-medium text-slate-400")}>
                  6MB 이상 자동 적용 · 큰 파일은 중복 확인 제외
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => setSelectionMode((prev) => !prev)}
              aria-pressed={selectionMode}
              className={cn(selectionMode ? styles.chipActive : styles.secondaryButton, `dashboard-files-control rounded-full px-4 py-2 text-sm font-semibold ${
                selectionMode
                  ? "border border-slate-900 bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`)}
            >
              {selectionMode ? "여러 파일 고르는 중" : "여러 파일 고르기"}
            </button>
          </div>
        </div>
      </section>

      <FileUploader ref={uploaderRef} onFiles={handleDropFiles}>
        <div className={cn(styles.uploadTray, "dashboard-files-card sticky top-2 z-30 grid gap-4 rounded-3xl border border-indigo-200 bg-indigo-50/90 px-4 py-4 text-sm shadow-sm backdrop-blur lg:grid-cols-[minmax(12rem,0.8fr)_minmax(16rem,1.2fr)_auto] lg:items-end")}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">UPLOAD TRAY / 올려놓기</p>
            <p className="mt-1 text-base font-black text-indigo-900">자료 놓는 곳</p>
            <p className="text-xs font-medium text-indigo-700">먼저 보드를 고른 뒤 파일을 끌어오세요.</p>
          </div>

          <div className={styles.boardPicker}>
            <label htmlFor="upload-board-target" className="text-[10px] font-black tracking-[0.12em] text-slate-600">
              파일을 넣을 보드
            </label>
            {boardOptions.length > 0 ? (
              <select
                ref={uploadBoardSelectRef}
                id="upload-board-target"
                value={selectedBoardId ?? ""}
                onChange={(event) => setSelectedBoardId(event.target.value || null)}
                aria-label="업로드할 보드 선택"
                aria-describedby="upload-target-status"
                className={cn(styles.inputShelf, "dashboard-files-input mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700")}
              >
                {boardOptions.map((board) => (
                  <option key={board.boardId} value={board.boardId}>{board.title}</option>
                ))}
              </select>
            ) : (
              <Link
                href={routes.page.dashboard.root()}
                onClick={(event) => event.stopPropagation()}
                className={cn(styles.secondaryButton, "dashboard-files-control mt-1 inline-flex min-h-11 items-center justify-center border border-slate-200 bg-white px-3 text-sm font-black text-slate-700")}
              >
                보드 만들기&nbsp;→
              </Link>
            )}
            <p id="upload-target-status" className="mt-1 text-xs font-bold text-slate-600">
              {selectedUploadBoard ? `${selectedUploadBoard.title}에 연결됩니다.` : "보드가 있어야 파일을 올릴 수 있어요."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleUploadClick}
            disabled={!canUpload}
            aria-describedby="upload-target-status"
            className={cn(styles.primaryButton, "dashboard-files-control rounded-full border border-indigo-600 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm")}
          >
            파일 선택
          </button>
        </div>

        <div className={cn(styles.filterRack, "dashboard-files-card sticky top-[96px] z-20 rounded-3xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur")}>
          <div className="flex flex-wrap items-center gap-3">
            <div className={cn(styles.inputShelf, "dashboard-files-input flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2")}>
              <span className="text-xs font-semibold text-slate-500">검색</span>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="파일명 또는 태그 검색"
                placeholder="파일명/태그 검색"
                className="min-w-0 w-full border-none text-sm outline-none"
              />
            </div>

            <select
              value={boardFilter ?? ""}
              onChange={(event) => setBoardFilter(event.target.value || null)}
              aria-label="보드로 파일 거르기"
              className={cn(styles.inputShelf, "dashboard-files-input rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600")}
            >
              <option value="">전체 보드</option>
              {boardOptions.map((board) => (
                <option key={board.boardId} value={board.boardId}>
                  {board.title}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              aria-label="파일 종류로 거르기"
              className={cn(styles.inputShelf, "dashboard-files-input rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600")}
            >
              <option value="any">모든 파일</option>
              <option value="image">이미지</option>
              <option value="pdf">PDF</option>
              <option value="video">비디오</option>
              <option value="audio">오디오</option>
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              aria-label="파일 정렬 순서"
              className={cn(styles.inputShelf, "dashboard-files-input rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600")}
            >
              <option value="recent">최신순</option>
              <option value="size">용량순</option>
              <option value="name">이름순</option>
            </select>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={cn(view === "grid" ? styles.chipActive : styles.chip, `dashboard-files-control rounded-full px-3 py-1 text-xs font-semibold ${
                  view === "grid" ? "border border-indigo-600 bg-indigo-600 text-white" : "border border-slate-200 text-slate-600"
                }`)}
              >
                카드
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={cn(view === "list" ? styles.chipActive : styles.chip, `dashboard-files-control rounded-full px-3 py-1 text-xs font-semibold ${
                  view === "list" ? "border border-indigo-600 bg-indigo-600 text-white" : "border border-slate-200 text-slate-600"
                }`)}
              >
                목록
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="태그로 파일 거르기">
            {tagChips.length === 0 ? (
              <span className="text-xs text-slate-400">최근 태그 없음</span>
            ) : (
              tagChips.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                  aria-pressed={tagFilter === tag}
                  aria-label={`${tag} 태그로 파일 거르기`}
                  className={cn(tagFilter === tag ? styles.chipActive : styles.chip, `dashboard-files-control rounded-full border px-3 py-1 text-xs font-semibold ${
                    tagFilter === tag
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-slate-100 text-slate-700"
                  }`)}
                >
                  #{tag}
                </button>
              ))
            )}
          </div>

          {selectionMode ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">선택 {selectedIds.size}개</span>
              <button
                type="button"
                onClick={(event) => requestFileDelete(Array.from(selectedIds), event.currentTarget)}
                disabled={selectedIds.size === 0}
                className={cn(styles.dangerButton, "dashboard-files-control dashboard-files-danger-control rounded-full border border-rose-500 bg-rose-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50")}
              >
                선택한 파일 삭제
              </button>
            </div>
          ) : null}
        </div>
        {uploadQueueVisible ? (
          <section className={cn(styles.queueSheet, "dashboard-files-card rounded-3xl border border-indigo-100 bg-indigo-50/70 px-5 py-4")} aria-labelledby="file-upload-queue-title">
            <h2 id="file-upload-queue-title" className="text-sm font-black text-indigo-700">올리는 중</h2>
            <div className="mt-3 space-y-2">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className={cn(styles.queueRow, "dashboard-files-row flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-transparent bg-white px-4 py-2 text-sm shadow-sm")}
                >
                  <span className="min-w-0 max-w-full truncate font-semibold text-slate-800">{item.file.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      {renderUploadStatus(item)}
                    </span>
                    {renderUploadSavings(item) ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                        {renderUploadSavings(item)}
                      </span>
                    ) : null}
                    {item.warning ? <span className="text-[11px] text-amber-600">{item.warning}</span> : null}
                    {item.status === "failed" && item.retryCount < 1 ? (
                      <button
                        type="button"
                        onClick={() => retryUpload(item)}
                        className={cn(styles.secondaryButton, "dashboard-files-control dashboard-files-danger-control rounded-full border border-rose-200 px-2 py-1 text-rose-600")}
                      >
                        재시도
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <div className={cn(styles.errorSheet, "dashboard-files-card rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3")} role="alert">
            <p className="text-sm font-semibold text-rose-700">불러오기에 실패했습니다.</p>
            <p className="mt-1 text-xs text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => void fetchFiles({ reset: true })}
              className={cn(styles.secondaryButton, "dashboard-files-control dashboard-files-danger-control mt-3 rounded-sm border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700")}
            >
              다시 시도
            </button>
          </div>
        ) : null}

        <section
          ref={libraryFocusRef}
          tabIndex={-1}
          className={cn(styles.libraryCabinet, "dashboard-files-card rounded-3xl border border-slate-200 bg-white p-4 shadow-sm")}
          aria-label="보관한 파일"
        >
          <div className={styles.libraryBody}>
            {isLoading && files.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500" role="status">파일을 꺼내는 중…</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="h-40 border-2 border-dashed border-[var(--theme-border)] bg-slate-100" />
                ))}
              </div>
            </div>
          ) : null}

          {!isLoading && files.length === 0 ? (
            <div className={cn(styles.emptySheet, "dashboard-files-empty-state rounded-2xl border border-dashed border-slate-200 p-6 text-center")}>
              <p className="text-lg font-black text-slate-700">첫 자료를 올려볼까요?</p>
              <p className="mt-2 text-sm font-medium text-slate-500">사진, PDF, 영상을 올리고 수업 이름으로 태그를 붙여두세요.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={!canUpload}
                  aria-describedby="upload-target-status"
                  className={cn(styles.primaryButton, "dashboard-files-control inline-flex items-center justify-center rounded-sm border border-indigo-600 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white")}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTagFilter(null);
                    setBoardFilter(null);
                    setQuery("");
                  }}
                  className={cn(styles.secondaryButton, "dashboard-files-control inline-flex items-center justify-center rounded-sm border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700")}
                >
                  필터 초기화
                </button>
              </div>
            </div>
          ) : null}

          {files.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <aside className="space-y-4">
                <div className={cn(styles.indexDrawer, "dashboard-files-card rounded-2xl border border-slate-200 bg-slate-50/70 p-4")}>
                  <p className="text-[10px] font-black tracking-[0.12em] text-slate-500">TAG INDEX</p>
                  <h3 className="mt-1 text-sm font-black text-slate-900">태그 색인</h3>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="태그로 파일 거르기">
                    {tagChips.length === 0 ? (
                      <span className="text-xs text-slate-400">최근 태그 없음</span>
                    ) : (
                      tagChips.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                          aria-pressed={tagFilter === tag}
                          aria-label={`${tag} 태그로 파일 거르기`}
                          className={cn(tagFilter === tag ? styles.chipActive : styles.chip, `dashboard-files-control rounded-full border px-3 py-1 text-xs font-semibold ${
                            tagFilter === tag
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-700"
                          }`)}
                        >
                          #{tag}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className={cn(styles.indexDrawer, "dashboard-files-card rounded-2xl border border-slate-200 bg-white p-4")}>
                  <p className="text-[10px] font-black tracking-[0.12em] text-slate-500">RECENT BOARDS</p>
                  <h3 className="mt-1 text-sm font-black text-slate-900">최근 보드</h3>
                  <div className="mt-3 space-y-2 text-xs">
                    {recentBoards.length === 0 ? (
                      <span className="text-slate-400">최근 보드 없음</span>
                    ) : (
                      recentBoards.map((board) => (
                        <button
                          key={board.boardId}
                          type="button"
                          onClick={() => setInsertBoardId(board.boardId)}
                          aria-pressed={insertBoardId === board.boardId}
                          className={cn(insertBoardId === board.boardId ? styles.chipActive : styles.chip, `dashboard-files-control w-full rounded-lg border px-3 py-2 text-left font-semibold ${
                            insertBoardId === board.boardId
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`)}
                        >
                          <p className="truncate">{board.title}</p>
                          <p className="mt-1 text-[10px] text-slate-400">업데이트 {formatDate(board.updatedAt ?? "")}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </aside>

              <div>
                {view === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {files.map((file) => (
                      <article
                        key={file.id}
                        className={cn(styles.fileCard, "dashboard-files-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm")}
                      >
                        {selectionMode ? (
                          <div className="absolute left-3 top-3 z-[3] border-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-2 shadow-[2px_2px_0_var(--theme-border-strong)]">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(file.id)}
                              onChange={() => toggleSelection(file.id)}
                              aria-label={`${file.filename} 선택`}
                            />
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelection(file.id);
                              return;
                            }
                            openDrawer(file.id, "details");
                          }}
                          className="dashboard-files-control flex min-w-0 flex-1 flex-col border border-transparent text-left"
                        >
                          <div className={cn(styles.previewWell, "relative flex h-36 items-center justify-center bg-slate-50")}>
                            {file.mime && SAFE_PREVIEW_PREFIXES.some((prefix) => file.mime?.startsWith(prefix)) ? (
                              <Image
                                src={apiV1Path(`files/${file.id}/view`)}
                                alt={file.filename}
                                fill
                                className="object-cover"
                                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-slate-500">
                                <span className="text-2xl">📄</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold">
                                  {file.filename.split(".").pop()?.toUpperCase() ?? "FILE"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                            <div>
                              <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{file.filename}</p>
                              <p className="text-xs text-slate-500">
                                {formatBytes(file.bytes)} · {formatDate(file.created_at)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                              {(file.tags ?? []).length > 0 ? renderTagSummary(file.tags) : <span>태그 없음</span>}
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDrawer(file.id, "insert")}
                            className={cn(styles.primaryButton, "dashboard-files-control rounded-full border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white")}
                          >
                            보드에 넣기
                          </button>
                          <FileMenu
                            onEditTags={() => openDrawer(file.id, "details")}
                            onDelete={(opener) => requestFileDelete([file.id], opener)}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={cn(styles.fileRow, "dashboard-files-row flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3")}
                      >
                        {selectionMode ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(file.id)}
                            onChange={() => toggleSelection(file.id)}
                            aria-label={`${file.filename} 선택`}
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelection(file.id);
                              return;
                            }
                            openDrawer(file.id, "details");
                          }}
                          className="dashboard-files-control flex min-w-[180px] flex-1 items-center gap-3 border-0 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{file.filename}</p>
                            <p className="text-xs text-slate-500">
                              {formatBytes(file.bytes)} · {formatDate(file.created_at)}
                            </p>
                          </div>
                          <div className="hidden flex-wrap gap-2 text-[11px] text-slate-500 sm:flex">
                            {(file.tags ?? []).length > 0 ? renderTagSummary(file.tags) : <span>태그 없음</span>}
                          </div>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDrawer(file.id, "insert")}
                            className={cn(styles.primaryButton, "dashboard-files-control rounded-full border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white")}
                          >
                            보드에 넣기
                          </button>
                          <FileMenu
                            onEditTags={() => openDrawer(file.id, "details")}
                            onDelete={(opener) => requestFileDelete([file.id], opener)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {nextCursor ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void fetchFiles({ reset: false })}
                      disabled={isLoading}
                      className={cn(styles.secondaryButton, "dashboard-files-control rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600")}
                    >
                      더 불러오기
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          </div>
        </section>
      </FileUploader>

      {drawerOpen && activeFile ? (
        <FileDetailDrawer
          file={activeFile}
          mode={drawerMode}
          onClose={() => {
            setDrawerOpen(false);
            setInsertSuccess(null);
          }}
          onSaveTags={handleTagUpdate}
          onInsert={handleInsertFile}
          recentBoards={recentBoards}
          boardSearch={boardSearch}
          setBoardSearch={setBoardSearch}
          insertBoardId={insertBoardId}
          setInsertBoardId={setInsertBoardId}
          filteredBoards={filteredBoards}
          insertSuccess={insertSuccess}
        />
      ) : null}

      {deleteRequest ? (
        <FileDeleteConfirmDialog
          request={deleteRequest}
          pending={deletePending}
          focusFallback={libraryFocusRef.current}
          onCancel={() => {
            if (!deletePending) setDeleteRequest(null);
          }}
          onConfirm={() => void confirmFileDelete()}
        />
      ) : null}
    </div>
  );
}

type FileDeleteConfirmDialogProps = {
  request: DeleteRequest;
  pending: boolean;
  focusFallback: HTMLElement | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function FileDeleteConfirmDialog({ request, pending, focusFallback, onCancel, onConfirm }: FileDeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    const focusFrame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      dialog.removeEventListener("keydown", handleKeyDown);
      const opener = request.opener;
      const openerUnavailable =
        !opener?.isConnected || opener.matches(":disabled") || opener.getAttribute("aria-disabled") === "true";
      const focusTarget = openerUnavailable && focusFallback?.isConnected ? focusFallback : opener;
      focusTarget?.focus();
    };
  }, [focusFallback, request.opener]);

  const count = request.fileIds.length;
  const title = count === 1 ? "이 파일을 영구 삭제할까요?" : `${count}개 파일을 영구 삭제할까요?`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="삭제 확인 닫기"
        className={cn(styles.dialogBackdrop, "absolute inset-0 border-0")}
        onClick={onCancel}
        disabled={pending}
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-delete-dialog-title"
        aria-describedby="file-delete-dialog-description"
        tabIndex={-1}
        className={cn(styles.confirmDialog, "dashboard-files-card relative z-10 w-full max-w-md p-5 sm:p-6")}
      >
        <p className="text-[10px] font-black tracking-[0.14em] text-rose-600">DANGER / 영구 삭제</p>
        <h2 id="file-delete-dialog-title" className="mt-2 text-xl font-black tracking-[-0.035em] text-slate-900">
          {title}
        </h2>
        <p id="file-delete-dialog-description" className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          삭제한 파일은 되돌릴 수 없습니다.
        </p>
        {request.filenames.length > 0 ? (
          <ul className={cn(styles.deleteFileList, "mt-4 max-h-32 overflow-y-auto p-3 text-xs font-bold text-slate-700")}>
            {request.filenames.slice(0, 6).map((filename, index) => <li key={`${filename}-${index}`} className="truncate">{filename}</li>)}
            {request.filenames.length > 6 ? <li>외 {request.filenames.length - 6}개</li> : null}
          </ul>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={cn(styles.secondaryButton, "dashboard-files-control min-h-12 px-4 text-sm font-black")}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(styles.dangerButton, "dashboard-files-control min-h-12 px-4 text-sm font-black")}
          >
            {pending ? "삭제 중…" : "영구 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

type FileMenuProps = {
  onEditTags: () => void;
  onDelete: (opener: HTMLElement | null) => void;
};

function FileMenu({ onEditTags, onDelete }: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => firstItemRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="파일 작업 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(styles.secondaryButton, "dashboard-files-control rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600")}
      >
        ⋯
      </button>
      {open ? (
        <div id={menuId} className={cn(styles.menu, "absolute right-0 top-11 z-10 w-36 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg")} role="menu">
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEditTags();
            }}
            className="dashboard-files-menu-item w-full rounded-lg px-3 py-2 text-left font-bold text-slate-700"
          >
            태그 편집
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete(triggerRef.current);
            }}
            className="dashboard-files-menu-item dashboard-files-danger-control w-full rounded-lg px-3 py-2 text-left font-bold text-rose-600"
          >
            영구 삭제
          </button>
        </div>
      ) : null}
    </div>
  );
}

type FileDetailDrawerProps = {
  file: BoardFile;
  mode: DrawerMode;
  onClose: () => void;
  onSaveTags: (fileId: string, tags: string[]) => Promise<void>;
  onInsert: (fileId: string, boardId: string) => Promise<void>;
  recentBoards: BoardLite[];
  boardSearch: string;
  setBoardSearch: (value: string) => void;
  filteredBoards: BoardLite[];
  insertBoardId: string | null;
  setInsertBoardId: (value: string | null) => void;
  insertSuccess: BoardLite | null;
};

function FileDetailDrawer({
  file,
  mode,
  onClose,
  onSaveTags,
  onInsert,
  recentBoards,
  boardSearch,
  setBoardSearch,
  filteredBoards,
  insertBoardId,
  setInsertBoardId,
  insertSuccess,
}: FileDetailDrawerProps) {
  const [tags, setTags] = useState<string[]>(file.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [insertLoading, setInsertLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const getFocusable = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    drawer.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      drawer.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    setTags(file.tags ?? []);
    setTagError(null);
  }, [file.tags]);

  const handleAddTag = useCallback(() => {
    const normalized = normalizeFileTagValue(tagInput);
    if (!normalized) {
      setTagError("태그는 영문/숫자/하이픈으로 1~24자 입력해 주세요.");
      return;
    }
    setTagError(null);
    setTags((prev) => {
      if (prev.includes(normalized)) return prev;
      if (prev.length >= TAG_LIMIT) {
        setTagError("태그는 최대 8개까지 가능합니다.");
        return prev;
      }
      return [...prev, normalized];
    });
    setTagInput("");
    tagInputRef.current?.focus();
  }, [tagInput]);

  const handleSaveTags = useCallback(async () => {
    if (tags.length > TAG_LIMIT) {
      setTagError("태그는 최대 8개까지 가능합니다.");
      return;
    }
    setSaving(true);
    await onSaveTags(file.id, tags);
    setSaving(false);
  }, [file.id, onSaveTags, tags]);

  const handleInsert = useCallback(async () => {
    if (!insertBoardId) return;
    setInsertLoading(true);
    try {
      await onInsert(file.id, insertBoardId);
    } catch (error) {
      console.error(error);
    } finally {
      setInsertLoading(false);
    }
  }, [file.id, insertBoardId, onInsert]);

  useEffect(() => {
    if (mode === "insert" && !insertBoardId && recentBoards[0]) {
      setInsertBoardId(recentBoards[0].boardId);
    }
  }, [insertBoardId, mode, recentBoards, setInsertBoardId]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="닫기"
        className={cn(styles.drawerBackdrop, "dashboard-files-control flex-1 border border-transparent bg-black/30")}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-detail-title"
        tabIndex={-1}
        className={cn(styles.drawer, "flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl")}
      >
        <div className={cn(styles.drawerHeader, "flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6")}>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">FILE CARD / 파일 카드</p>
            <h2 id="file-detail-title" className="mt-1 truncate text-lg font-black text-slate-900">{file.filename}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={cn(styles.secondaryButton, "dashboard-files-control rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600")}
          >
            닫기
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className={cn(styles.drawerSection, "dashboard-files-card rounded-2xl border border-slate-200 bg-slate-50/60 p-4")}>
            <p className="text-[10px] font-black tracking-[0.12em] text-slate-500">PREVIEW</p>
            <div className={cn(styles.previewFrame, "relative mt-3 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-white")}>
              {file.mime && SAFE_PREVIEW_PREFIXES.some((prefix) => file.mime?.startsWith(prefix)) ? (
                <Image
                  src={apiV1Path(`files/${file.id}/view`)}
                  alt={file.filename}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              ) : (
                <div className="text-center text-slate-500">
                  <span className="text-3xl">📄</span>
                  <p className="mt-2 text-xs">지원되는 이미지 파일만 미리보기됩니다.</p>
                </div>
              )}
            </div>
          </section>

          <section className={cn(styles.drawerSection, "dashboard-files-card rounded-2xl border border-slate-200 p-4")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">태그 편집</p>
                <p className="text-sm font-semibold text-slate-800">필요한 태그를 추가하세요.</p>
              </div>
              <button
                type="button"
                onClick={handleSaveTags}
                disabled={saving}
                className={cn(styles.primaryButton, "dashboard-files-control rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60")}
              >
                저장
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.length === 0 ? <span className="text-xs text-slate-400">태그 없음</span> : null}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => {
                      setTags((prev) => prev.filter((value) => value !== tag));
                      setTagError(null);
                    }}
                    aria-label={`${tag} 태그 제거`}
                    className="dashboard-files-control border border-transparent text-[10px] text-slate-400"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className={cn(styles.inputShelf, "dashboard-files-input mt-3 flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1")}>
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="태그 입력"
                aria-label="새 태그 입력"
                className="min-w-0 w-full border-none text-xs outline-none"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className={cn(styles.primaryButton, "dashboard-files-control rounded-full border border-slate-900 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white")}
              >
                추가
              </button>
            </div>
            {tagError ? <p className="mt-2 text-xs font-semibold text-rose-600">{tagError}</p> : null}
          </section>

          <section className={cn(styles.drawerSection, "dashboard-files-card rounded-2xl border border-slate-200 p-4")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">보드에 넣기</p>
                <p className="text-sm font-semibold text-slate-800">최근 보드</p>
              </div>
              <button
                type="button"
                onClick={() => setInsertBoardId(null)}
                className="dashboard-files-control border border-transparent text-xs font-semibold text-slate-400"
              >
                선택 풀기
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recentBoards.map((board) => (
                <button
                key={board.boardId}
                type="button"
                onClick={() => setInsertBoardId(board.boardId)}
                  aria-pressed={insertBoardId === board.boardId}
                  className={cn(insertBoardId === board.boardId ? styles.chipActive : styles.chip, `dashboard-files-control rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                    insertBoardId === board.boardId
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600"
                  }`)}
                >
                  <p className="truncate">{board.title}</p>
                  <p className="mt-1 text-[10px] text-slate-400">업데이트 {formatDate(board.updatedAt ?? "")}</p>
                </button>
              ))}
              {recentBoards.length === 0 ? <p className="text-xs text-slate-400">아직 보드가 없어요.</p> : null}
            </div>

            <div className="mt-4 border-2 border-dashed border-[var(--theme-border)] bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">보드 검색</p>
              <input
                value={boardSearch}
                onChange={(event) => setBoardSearch(event.target.value)}
                aria-label="넣을 보드 검색"
                placeholder="보드 이름 검색"
                className={cn(styles.inputShelf, "dashboard-files-input mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs")}
              />
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {filteredBoards.map((board) => (
                  <button
                    key={board.boardId}
                    type="button"
                    onClick={() => setInsertBoardId(board.boardId)}
                    aria-pressed={insertBoardId === board.boardId}
                    className={cn(insertBoardId === board.boardId ? styles.chipActive : styles.chip, `dashboard-files-control w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                      insertBoardId === board.boardId
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`)}
                  >
                    {board.title}
                  </button>
                ))}
                {filteredBoards.length === 0 ? (
                  <p className="text-xs text-slate-400">검색 결과가 없습니다.</p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={handleInsert}
              disabled={!insertBoardId || insertLoading}
              className={cn(styles.primaryButton, "dashboard-files-control mt-4 w-full rounded-full border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50")}
            >
              {insertLoading ? "넣는 중…" : "선택한 보드에 넣기"}
            </button>

            {mode === "insert" && insertSuccess ? (
              <div className={cn(styles.successSheet, "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700")}>
                <p className="font-semibold">보드에 추가됨</p>
                <p className="mt-1">{insertSuccess.title}</p>
                <Link
                  href={boardBoardHref(insertSuccess.boardId)}
                  data-interactive="true"
                  className={cn(styles.primaryButton, "dashboard-files-control mt-3 inline-flex items-center rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white")}
                >
                  보드 열기
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </aside>
    </div>
  );
}

function renderTagSummary(tags: string[]) {
  const visible = tags.slice(0, 2);
  const rest = tags.length - visible.length;
  return (
    <>
      {visible.map((tag) => (
        <span key={tag}>#{tag}</span>
      ))}
      {rest > 0 ? <span>+{rest}</span> : null}
    </>
  );
}

function renderUploadStatus(item: UploadItem) {
  if (item.status === "optimizing") return "최적화 중";
  if (item.status === "optimized" && typeof item.bytesSaved === "number" && item.bytesSaved > 0) {
    return `최적화됨 (-${formatBytes(item.bytesSaved)})`;
  }
  if (item.status === "uploading") {
    if (typeof item.progress === "number") {
      return `업로드 중 ${item.progress}%`;
    }
    return "업로드 중";
  }
  if (item.status === "deduped") return "중복 감지";
  if (item.status === "completed") return "완료";
  if (item.status === "failed") return item.error ?? "실패";
  return "대기";
}

function renderUploadSavings(item: UploadItem): string | null {
  if (item.dedupReused) {
    return "중복 감지: 업로드 생략";
  }
  if (!item.bytesOriginal || !item.bytesStored) {
    return null;
  }
  if (item.bytesStored >= item.bytesOriginal) {
    return null;
  }
  const percent = Math.round(((item.bytesOriginal - item.bytesStored) / item.bytesOriginal) * 100);
  return `${formatBytes(item.bytesOriginal)} → ${formatBytes(item.bytesStored)} (-${percent}%)`;
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
  if (!value) return "-";
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
    const img = document.createElement("img");
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
