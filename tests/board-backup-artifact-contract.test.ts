import assert from "node:assert/strict";
import test from "node:test";
import { buildBoardBackupZipArtifact } from "@/lib/board/boardBackupArtifacts.client";

test("board backup filename is bounded and the promised README limits are durable", async () => {
  const artifact = await buildBoardBackupZipArtifact({ boardId: "fixture-board", boardTitle: `bad:/\\*?${"x".repeat(70)}`, boardDescription: null, boardTheme: {}, exportedAt: new Date("2026-07-20T00:00:00.000Z"), walls: [] });
  assert.equal(artifact.mimeType, "application/zip"); assert.match(artifact.fileName, /^gomdory-board-[\p{L}\p{N}_-]{1,40}-2026-07-20\.zip$/u); assert.match(artifact.fileName, /^gomdory-board-bad_/); assert.doesNotMatch(artifact.fileName, /[\\/:*?]/); assert.ok(artifact.blob.size > 0);
  const text = await artifact.blob.text();
  assert.match(text, /실제 이미지, 문서, 영상, 음악 파일은 ZIP에 포함되지 않습니다/); assert.match(text, /개인정보를 확인/); assert.match(text, /자동 복원 기능은 제공하지 않습니다/);
});
