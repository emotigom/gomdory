import assert from "node:assert/strict";
import test from "node:test";

import { computeStorageSummary } from "@/lib/data/storageSummary";

test("computeStorageSummary returns zeros when empty", () => {
  const summary = computeStorageSummary([]);

  assert.equal(summary.totalBytes, 0);
  assert.equal(summary.uploadedThisMonthBytes, 0);
  assert.equal(summary.actualSavings.totalBytesSaved, 0);
  assert.equal(summary.byBoard.length, 0);
  assert.equal(summary.byClass.length, 0);
  assert.equal(summary.topLargest.length, 0);
  assert.equal(summary.stale.length, 0);
});

test("computeStorageSummary sorts and aggregates correctly", () => {
  const nowIso = new Date().toISOString();
  const summary = computeStorageSummary([
    {
      id: "file-a",
      name: "a.png",
      bytes: 900,
      mime: "image/png",
      boardId: "board-1",
      boardTitle: "보드 A",
      classId: "class-1",
      classTitle: "1반",
      createdAt: "2023-12-01T00:00:00Z",
      originalBytes: 1_500,
      optimizedBytes: 900,
    },
    {
      id: "file-b",
      name: "b.mov",
      bytes: 4_000,
      mime: "video/quicktime",
      boardId: "board-2",
      boardTitle: "보드 B",
      createdAt: "2024-02-01T00:00:00Z",
    },
    {
      id: "file-c",
      name: "a.png",
      bytes: 900,
      mime: "image/png",
      boardId: "board-1",
      boardTitle: "보드 A",
      classId: "class-1",
      classTitle: "1반",
      createdAt: nowIso,
      originalBytes: 1_200,
      optimizedBytes: 900,
    },
  ]);

  assert.equal(summary.totalBytes, 5_800);
  assert.equal(summary.byBoard[0]?.boardId, "board-2");
  assert.equal(summary.byBoard[0]?.bytes, 4_000);
  assert.equal(summary.byClass[0]?.classId, "class-1");
  assert.equal(summary.byClass[0]?.fileCount, 2);
  assert.equal(summary.topLargest[0]?.name, "b.mov");
  assert.equal(summary.topLargest[0]?.bytes, 4_000);
  assert.equal(summary.stale[0]?.name, "a.png");
  assert.equal(summary.actualSavings.totalBytesSaved, 900);
  assert.ok(summary.actualSavings.savedThisMonthBytes >= 300);
  assert.ok(summary.estSavings.ifDedup > 0, "duplicate names should create dedup saving estimate");
  assert.ok(summary.estSavings.ifDownscaleImages > 0, "image files produce downscale estimate");
});
