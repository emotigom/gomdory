import assert from "node:assert/strict";
import test from "node:test";

import { strFromU8, unzipSync } from "fflate";

import { buildBoardBackupZipArtifact } from "@/lib/board/boardBackupArtifacts.client";
import type { BoardBackupWallInput } from "@/lib/board/boardBackupArtifacts.client";

test("builds a privacy-conscious board backup ZIP", async () => {
  const artifact = await buildBoardBackupZipArtifact({
    boardId: "source-board-1",
    boardTitle: "남동중:AI수업?",
    boardDescription: "AI 작품 보드",
    boardTheme: { id: "calm", accent: "cyan" },
    exportedAt: new Date("2026-07-14T03:00:00.000Z"),
    walls: [
      {
        wall: { id: "private-section-id", title: "오늘의 작품", description: "첫 번째 섹션" },
        cards: [
          {
            text: "첫 번째 카드",
            author_name: "교사",
            author_type: "teacher",
            created_at: "2026-07-14T01:00:00.000Z",
            tags: [{ name: "안내", color: "blue" }],
          },
          {
            id: "private-card-id",
            owner_id: "private-owner-id",
            currentUserId: "private-current-user-id",
            boardAccessCode: "private-board-access-code",
            oauthToken: "oauth-secret-token-sample",
            text: "학생이 만든 작품\n자세한 설명",
            author_nickname: "5번 학생",
            author_type: "student",
            is_hidden: true,
            hidden_at: "2026-07-14T02:00:00.000Z",
            card_color_token: "mint",
            attachments: [
              {
                id: "private-attachment-id",
                attachmentId: "private-attachment-reference",
                fileId: "private-file-id",
                boardFileId: "private-board-file-id",
                binary: "PNG_BINARY_CONTENT",
                kind: "image",
                label: "drawing.png",
                url: "/api/v1/files/original-image-reference",
                contentType: "image/png",
                size: 135000,
              },
            ],
          },
        ],
      },
      {
        wall: { title: "두 번째 섹션", description: null },
        cards: [{ text: "마지막 카드", author_type: "student" }],
      },
    ] as unknown as BoardBackupWallInput[],
  });
  const files = unzipSync(new Uint8Array(await artifact.blob.arrayBuffer()));

  assert.equal(artifact.mimeType, "application/zip");
  assert.match(artifact.fileName, /^gomdory-board-남동중_AI수업-2026-07-14\.zip$/);
  assert.deepEqual(Object.keys(files).sort(), [
    "gomdory-board-backup/README.txt",
    "gomdory-board-backup/attachments-manifest.json",
    "gomdory-board-backup/board.json",
  ]);

  const boardText = strFromU8(files["gomdory-board-backup/board.json"]!);
  const boardBackup = JSON.parse(boardText);
  assert.equal(boardBackup.format, "gomdory-board-backup");
  assert.equal(boardBackup.schemaVersion, 1);
  assert.equal(boardBackup.board.sectionCount, 2);
  assert.equal(boardBackup.board.cardCount, 3);
  assert.equal(boardBackup.board.attachmentCount, 1);
  assert.deepEqual(boardBackup.board.theme, { id: "calm", accent: "cyan" });
  assert.deepEqual(
    boardBackup.board.sections.map((section: { order: number; title: string }) => [section.order, section.title]),
    [[0, "오늘의 작품"], [1, "두 번째 섹션"]],
  );
  assert.deepEqual(
    boardBackup.board.sections[0].cards.map((card: { order: number; text: string }) => [card.order, card.text]),
    [[0, "첫 번째 카드"], [1, "학생이 만든 작품\n자세한 설명"]],
  );
  const studentCard = boardBackup.board.sections[0].cards[1];
  assert.equal(studentCard.hidden, true);
  assert.equal(studentCard.hiddenAt, "2026-07-14T02:00:00.000Z");
  assert.equal(studentCard.colorToken, "mint");
  assert.deepEqual(studentCard.attachments[0], {
    kind: "image",
    label: "drawing.png",
    contentType: "image/png",
    size: 135000,
    sourceUrl: "/api/v1/files/original-image-reference",
  });

  const manifest = JSON.parse(
    strFromU8(files["gomdory-board-backup/attachments-manifest.json"]!),
  );
  assert.deepEqual(manifest[0], {
    sectionOrder: 0,
    sectionTitle: "오늘의 작품",
    cardOrder: 1,
    cardTextPreview: "학생이 만든 작품 자세한 설명",
    authorDisplayName: "5번 학생",
    kind: "image",
    label: "drawing.png",
    contentType: "image/png",
    size: 135000,
    sourceUrl: "/api/v1/files/original-image-reference",
  });

  const allZipText = Object.values(files).map((file) => strFromU8(file)).join("\n");
  for (const forbidden of [
    "owner_id",
    "fileId",
    "boardFileId",
    "attachmentId",
    "currentUserId",
    "boardAccessCode",
    "oauth-secret-token-sample",
  ]) {
    assert.doesNotMatch(allZipText, new RegExp(forbidden));
  }
  assert.doesNotMatch(allZipText, /PNG_BINARY_CONTENT/);

  const readme = strFromU8(files["gomdory-board-backup/README.txt"]!);
  assert.match(readme, /실제 이미지, 문서, 영상, 음악 파일은 ZIP에 포함되지 않습니다/);
  assert.match(readme, /개인정보를 확인/);
});
