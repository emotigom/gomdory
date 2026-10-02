import assert from "node:assert/strict";
import test from "node:test";

import { buildStudentGalleryStandaloneHtml } from "@/lib/board/studentGalleryStandaloneHtml";
import type { StudentGalleryExportItem } from "@/lib/board/studentGalleryExport";

function galleryItem(overrides: Partial<StudentGalleryExportItem> = {}): StudentGalleryExportItem {
  return {
    title: "꿈의 정원",
    author: "별칭 학생",
    summary: "AI로 만든 미래 정원입니다.",
    tools: "ChatGPT",
    aiHelp: "배경 아이디어를 도와줬어요.",
    humanEdit: "색감을 고쳤어요.",
    type: "image",
    imageUrl: "/files/cover.png",
    mediaUrl: "",
    externalUrl: "",
    cardText: "작품 소개: AI로 만든 미래 정원입니다.",
    columnName: "작품 올리기",
    ...overrides,
  };
}

test("builds a standalone HTML document with embedded works data", () => {
  const html = buildStudentGalleryStandaloneHtml([galleryItem()]);

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<script type="application\/json" id="gallery-data">/);
  assert.match(html, /꿈의 정원/);
  assert.match(html, /\/files\/cover\.png/);
  assert.match(html, /우리 반 AI 작품 모음집/);
});

test("escapes closing script text inside embedded works data", () => {
  const html = buildStudentGalleryStandaloneHtml([
    galleryItem({
      title: '나쁜 문자열 </script><script>alert("x")</script>',
      cardText: "텍스트 </script> 끝",
    }),
  ]);

  assert.match(html, /\\u003c\/script\\u003e\\u003cscript\\u003e/);
  assert.match(html, /텍스트 \\u003c\/script\\u003e 끝/);
  assert.doesNotMatch(html, /나쁜 문자열 <\/script><script>alert/);
});

test("includes render support for every gallery work type", () => {
  const html = buildStudentGalleryStandaloneHtml([
    galleryItem({ type: "image" }),
    galleryItem({ type: "video", mediaUrl: "/files/movie.mp4" }),
    galleryItem({ type: "audio", mediaUrl: "/files/song.mp3" }),
    galleryItem({ type: "external-link", externalUrl: "https://example.com/work" }),
    galleryItem({ type: "html", mediaUrl: "/files/app.html" }),
    galleryItem({ type: "text", cardText: "텍스트 작품 본문" }),
  ]);

  for (const label of ["이미지", "영상", "음악", "외부 링크", "HTML", "텍스트"]) {
    assert.match(html, new RegExp(label));
  }

  assert.match(html, /createElement\("img"\)/);
  assert.match(html, /createElement\("video"\)/);
  assert.match(html, /createElement\("audio"\)/);
  assert.match(html, /외부 링크 새 탭으로 열기/);
  assert.match(html, /HTML 작품 새 탭으로 열기/);
  assert.match(html, /text-preview/);
});

test("uses new-tab links without iframe or external fetch behavior", () => {
  const html = buildStudentGalleryStandaloneHtml([
    galleryItem({
      type: "external-link",
      externalUrl: "https://example.com/work",
    }),
  ]);

  assert.match(html, /target = "_blank"/);
  assert.match(html, /rel = "noreferrer noopener"/);
  assert.doesNotMatch(html, /iframe/i);
  assert.doesNotMatch(html, /\bfetch\s*\(/i);
});
