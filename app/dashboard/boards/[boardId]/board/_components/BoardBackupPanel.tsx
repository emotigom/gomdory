"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { GoogleDriveSaveButton } from "@/app/_components/google-drive/GoogleDriveSaveButton";
import {
  buildBoardBackupZipArtifact,
  downloadBoardBackupArtifact,
  type BoardBackupWallInput,
} from "@/lib/board/boardBackupArtifacts.client";
import {
  finishBoardBackupDownload,
  idleBoardBackupDownloadState,
  startBoardBackupDownload,
  type BoardBackupDownloadState,
} from "@/lib/board/boardBackupDownloadState";

type Props = {
  boardId: string;
  boardTitle: string;
  boardDescription: string | null;
  boardTheme: unknown;
  walls: BoardBackupWallInput[];
};

export default function BoardBackupPanel({
  boardId,
  boardTitle,
  boardDescription,
  boardTheme,
  walls,
}: Props) {
  const [downloadState, setDownloadState] = useState<BoardBackupDownloadState>(idleBoardBackupDownloadState);
  const activeOperation = useRef<number | null>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const createArtifact = useCallback(
    () =>
      buildBoardBackupZipArtifact({
        boardId,
        boardTitle,
        boardDescription,
        boardTheme,
        walls,
      }),
    [boardDescription, boardId, boardTheme, boardTitle, walls],
  );

  const downloadBackup = async () => {
    // A ref closes the same-event-loop window before React can render disabled.
    if (activeOperation.current !== null) return;
    const next = startBoardBackupDownload(downloadState);
    if (!next) return;
    activeOperation.current = next.operation;
    setDownloadState(next);
    try {
      const artifact = await createArtifact();
      if (activeOperation.current !== next.operation) return;
      downloadBoardBackupArtifact(artifact);
      setDownloadState((current) => finishBoardBackupDownload(current, next.operation, "download-initiated"));
    } catch {
      if (activeOperation.current === next.operation) {
        setDownloadState((current) => finishBoardBackupDownload(current, next.operation, "retryable-failure"));
      }
    } finally {
      if (activeOperation.current === next.operation) activeOperation.current = null;
    }
  };

  const downloading = downloadState.phase === "building";
  const status = downloadState.phase === "download-initiated"
    ? "백업 파일 다운로드를 시작했습니다."
    : null;
  const error = downloadState.phase === "retryable-failure"
    ? "보드 백업 파일을 만들지 못했습니다. 다시 시도해 주세요."
    : null;

  useEffect(() => {
    if (downloadState.phase === "retryable-failure") downloadButtonRef.current?.focus();
  }, [downloadState.phase]);

  return (
    <section className="space-y-3 text-sm text-[var(--theme-text)]" aria-label="보드 백업">
      <div>
        <p className="text-xs font-semibold text-[var(--theme-text-muted)]">보드 백업</p>
        <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
          섹션·카드·테마와 첨부 목록을 저장합니다.<br />
          첨부 원본 파일은 포함되지 않습니다.
        </p>
        <p className="mt-2 text-[11px] leading-4 text-amber-200">
          학생 이름과 작성 내용이 포함될 수 있으니 공유 전 개인정보를 확인해 주세요.
        </p>
      </div>
      <div className="space-y-2">
        <button
          ref={downloadButtonRef}
          type="button"
          onClick={() => void downloadBackup()}
          disabled={downloading}
          className="block min-h-10 w-full rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-center text-xs font-medium text-[var(--theme-action-text)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {downloading ? "백업 파일 만드는 중…" : "보드 백업 ZIP 다운로드"}
        </button>
        <GoogleDriveSaveButton
          purpose="board-backup"
          defaultFolderName="보드 백업"
          buttonLabel="Drive에 백업 저장"
          disabled={downloading}
          createFile={createArtifact}
          className="w-full"
        />
      </div>
      {status ? <p aria-atomic="true" aria-live="polite" role="status" className="text-xs text-[var(--theme-text-muted)]">{status}</p> : null}
      {error ? <p aria-atomic="true" role="alert" className="text-xs text-[var(--theme-text-muted)]">{error}</p> : null}
    </section>
  );
}
