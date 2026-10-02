"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useMemo, useState } from "react";

import { saveOfflineBoardPack } from "@/lib/offline/packStore";

type OfflinePackButtonProps = {
  boardId: string;
  boardTitle: string;
};

type DownloadState =
  | { status: "idle" }
  | { status: "downloading"; received: number; total: number | null }
  | { status: "saved" }
  | { status: "error"; message: string };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function OfflinePackButton({ boardId, boardTitle }: OfflinePackButtonProps) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });

  const progressLabel = useMemo(() => {
    if (state.status !== "downloading") return null;
    const totalLabel = state.total ? ` / ${formatBytes(state.total)}` : "";
    return `${formatBytes(state.received)}${totalLabel}`;
  }, [state]);

  const handleDownload = async () => {
    setState({ status: "downloading", received: 0, total: null });
    try {
      const response = await fetch(apiV1Path(`dashboard/boards/${boardId}/export-zip`));
      if (!response.ok) {
        throw new Error("ZIP 다운로드에 실패했습니다.");
      }

      const total = response.headers.get("content-length");
      const totalBytes = total ? Number(total) : null;

      if (response.body) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const safeChunk = new Uint8Array(value);
            chunks.push(safeChunk);
            received += safeChunk.length;
            setState({ status: "downloading", received, total: totalBytes });
          }
        }
        const blob = new Blob(chunks, { type: "application/zip" });
        await saveOfflineBoardPack({ boardId, title: boardTitle, blob });
        setState({ status: "saved" });
        return;
      }

      const blob = await response.blob();
      await saveOfflineBoardPack({ boardId, title: boardTitle, blob });
      setState({ status: "saved" });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "오프라인 저장에 실패했습니다.",
      });
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={state.status === "downloading"}
        className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.status === "downloading" ? "저장 중..." : "오프라인으로 저장"}
      </button>
      <div className="text-xs text-gray-500">
        {state.status === "downloading" && progressLabel
          ? `다운로드 중: ${progressLabel}`
          : null}
        {state.status === "saved" ? "저장 완료! 오프라인 보드 목록에서 확인하세요." : null}
        {state.status === "error" ? state.message : null}
      </div>
    </div>
  );
}
