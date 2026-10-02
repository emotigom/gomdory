export type BoardBackupDownloadPhase =
  | "idle"
  | "building"
  | "download-initiated"
  | "retryable-failure";

export type BoardBackupDownloadState = {
  phase: BoardBackupDownloadPhase;
  operation: number;
};

export const idleBoardBackupDownloadState: BoardBackupDownloadState = {
  phase: "idle",
  operation: 0,
};

// The sequence is deliberately local: it identifies an explicit panel action,
// rather than exposing a board identifier or deriving identity from a filename.
export function startBoardBackupDownload(
  current: BoardBackupDownloadState,
): BoardBackupDownloadState | null {
  if (current.phase === "building") return null;
  return { phase: "building", operation: current.operation + 1 };
}

export function finishBoardBackupDownload(
  current: BoardBackupDownloadState,
  operation: number,
  result: "download-initiated" | "retryable-failure",
): BoardBackupDownloadState {
  if (current.phase !== "building" || current.operation !== operation) return current;
  return { phase: result, operation };
}
