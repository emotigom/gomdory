import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStudentGalleryChatGptPrompt,
  buildStudentGalleryExportItems,
  parseArtworkCardFields,
} from "@/lib/board/studentGalleryExport";
import type { FinalArtworkSubmission } from "@/lib/board/studentSubmissionSummary";

const artwork: FinalArtworkSubmission = {
  cardId: "card-1",
  wallId: "wall-1",
  wallTitle: "작품 올리기",
  authorLabel: "별칭 학생",
  attachmentCount: 2,
  title: "첫 줄 제목",
  createdAt: "2026-06-22T00:00:00Z",
  isFinalArtwork: true,
  excerpt: "작품 제목: 꿈의 정원",
  cardText: `작품 제목: 꿈의 정원
작품 소개: AI로 만든 미래 정원입니다.
사용한 AI 도구: ChatGPT, 이미지 생성 도구
AI가 도와준 부분: 배경 아이디어
내가 직접 고친 부분: 색감과 제목
외부 작품 링크: https://example.com/work
영상 설명: 바람이 부는 장면
음악 분위기: 차분함
실행 방법: index.html 열기`,
  representativeImage: { label: "cover.png", url: "/files/cover.png", contentType: "image/png" },
  videoAttachment: null,
  audioAttachment: null,
  htmlAttachment: { label: "index.html", url: "/apps/work/index.html", contentType: "text/html" },
  externalLinks: ["https://example.com/work"],
  mediaTypes: ["image", "html", "external-link"],
  badgeLabels: ["이미지", "HTML/웹앱", "외부 링크", "첨부 있음"],
  hasNonImageAttachment: true,
};

test("parses student helper template fields from card text", () => {
  const fields = parseArtworkCardFields(artwork.cardText);

  assert.equal(fields.title, "꿈의 정원");
  assert.equal(fields.summary, "AI로 만든 미래 정원입니다.");
  assert.equal(fields.tools, "ChatGPT, 이미지 생성 도구");
  assert.equal(fields.aiHelp, "배경 아이디어");
  assert.equal(fields.humanEdit, "색감과 제목");
  assert.equal(fields.externalUrl, "https://example.com/work");
  assert.equal(fields.videoDescription, "바람이 부는 장면");
  assert.equal(fields.musicMood, "차분함");
  assert.equal(fields.runInstructions, "index.html 열기");
});

test("builds gallery export items and ChatGPT prompt from final artworks", () => {
  const [item] = buildStudentGalleryExportItems([artwork]);
  const prompt = buildStudentGalleryChatGptPrompt([artwork]);

  assert.equal(item?.title, "꿈의 정원");
  assert.equal(item?.author, "별칭 학생");
  assert.equal(item?.summary, "AI로 만든 미래 정원입니다.");
  assert.equal(item?.type, "image");
  assert.equal(item?.imageUrl, "/files/cover.png");
  assert.equal(item?.mediaUrl, "/apps/work/index.html");
  assert.equal(item?.externalUrl, "https://example.com/work");
  assert.equal(item?.columnName, "작품 올리기");
  assert.match(prompt, /외부 링크는 iframe으로 넣지 말고 새 탭 버튼으로 열기/);
  assert.match(prompt, /"title": "꿈의 정원"/);
});
