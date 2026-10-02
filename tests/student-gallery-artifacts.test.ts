import assert from "node:assert/strict";
import test from "node:test";

import { unzipSync, strFromU8 } from "fflate";

import { buildStudentGalleryZipArtifact } from "@/lib/board/studentGalleryArtifacts.client";
import type { FinalArtworkSubmission } from "@/lib/board/studentSubmissionSummary";

const artwork: FinalArtworkSubmission = {
  cardId: "private-card-id",
  wallId: "private-wall-id",
  wallTitle: "작품 올리기",
  authorLabel: "별칭 학생",
  attachmentCount: 0,
  title: "꿈의 정원",
  createdAt: "2026-07-14T00:00:00Z",
  isFinalArtwork: true,
  excerpt: "꿈의 정원",
  cardText: "작품 제목: 꿈의 정원\n작품 소개: 미래 정원입니다.",
  representativeImage: { label: "cover.png", url: "https://example.com/cover.png", contentType: "image/png" },
  videoAttachment: null,
  audioAttachment: null,
  htmlAttachment: null,
  externalLinks: [],
  mediaTypes: ["image"],
  badgeLabels: ["이미지"],
  hasNonImageAttachment: false,
};

test("builds a teacher gallery ZIP with the three export files", async () => {
  const artifact = await buildStudentGalleryZipArtifact({
    finalArtworkCards: [artwork],
    boardId: "board-1",
  });
  const files = unzipSync(new Uint8Array(await artifact.blob.arrayBuffer()));

  assert.equal(artifact.mimeType, "application/zip");
  assert.equal(artifact.fileName, "ai-gallery-final.zip");
  assert.deepEqual(Object.keys(files).sort(), [
    "ai-gallery-final/README.txt",
    "ai-gallery-final/gallery-data.json",
    "ai-gallery-final/index.html",
  ]);

  const data = JSON.parse(strFromU8(files["ai-gallery-final/gallery-data.json"]!));
  assert.equal(data[0].title, "꿈의 정원");
  assert.equal(data[0].cardId, undefined);
  assert.match(strFromU8(files["ai-gallery-final/index.html"]!), /꿈의 정원/);
  assert.match(strFromU8(files["ai-gallery-final/README.txt"]!), /인터넷 연결|외부 URL/);
});
