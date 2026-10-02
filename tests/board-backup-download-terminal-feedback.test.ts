import assert from "node:assert/strict";
import test from "node:test";

import {
  finishBoardBackupDownload,
  idleBoardBackupDownloadState,
  startBoardBackupDownload,
} from "@/lib/board/boardBackupDownloadState";

test("board backup reaches terminal success only after its active handoff", () => {
  const pending = startBoardBackupDownload(idleBoardBackupDownloadState);
  assert.deepEqual(pending, { phase: "building", operation: 1 });
  assert.deepEqual(finishBoardBackupDownload(pending!, 1, "download-initiated"), { phase: "download-initiated", operation: 1 });
});

test("board backup rejects duplicate activation and allows an explicit retry after failure", () => {
  const pending = startBoardBackupDownload(idleBoardBackupDownloadState)!;
  assert.equal(startBoardBackupDownload(pending), null);
  const failed = finishBoardBackupDownload(pending, 1, "retryable-failure");
  assert.deepEqual(startBoardBackupDownload(failed), { phase: "building", operation: 2 });
});

test("a stale operation cannot overwrite a retry result", () => {
  const pending = { phase: "building", operation: 2 } as const;
  assert.deepEqual(finishBoardBackupDownload(pending, 1, "download-initiated"), pending);
});
