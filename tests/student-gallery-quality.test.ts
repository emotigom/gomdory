import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectStudentGalleryExportItems,
  type StudentGalleryQualityIssue,
} from "@/lib/board/studentGalleryQuality";
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

function messagesByKind(issues: readonly StudentGalleryQualityIssue[], kind: StudentGalleryQualityIssue["kind"]) {
  return issues.filter((issue) => issue.kind === kind).map((issue) => issue.message);
}

test("reports recommended missing fields and missing media without blocking export", () => {
  const result = inspectStudentGalleryExportItems([
    galleryItem({
      title: "",
      summary: "",
      tools: "",
      aiHelp: "",
      imageUrl: "",
    }),
  ]);

  assert.equal(result.artworkCount, 1);
  assert.equal(result.affectedArtworkCount, 1);
  assert.match(result.summary, /최종 작품 1개 중 확인 필요 1개/);
  assert.deepEqual(messagesByKind(result.issues, "recommended"), [
    "작품 제목 없음",
    "작품 소개 없음",
    "사용한 AI 도구 없음",
    "AI가 도와준 부분 없음",
  ]);
  assert.deepEqual(messagesByKind(result.issues, "media"), ["이미지 작품인데 imageUrl이 비어 있어요."]);
});

test("reports media issues by artwork type except text", () => {
  const result = inspectStudentGalleryExportItems([
    galleryItem({ title: "영상", type: "video", imageUrl: "", mediaUrl: "" }),
    galleryItem({ title: "음악", type: "audio", imageUrl: "", mediaUrl: "" }),
    galleryItem({ title: "링크", type: "external-link", imageUrl: "", mediaUrl: "", externalUrl: "" }),
    galleryItem({ title: "HTML", type: "html", imageUrl: "", mediaUrl: "", externalUrl: "" }),
    galleryItem({ title: "텍스트", type: "text", imageUrl: "", mediaUrl: "", externalUrl: "" }),
  ]);

  assert.deepEqual(messagesByKind(result.issues, "media"), [
    "영상 작품인데 mediaUrl이 비어 있어요.",
    "음악 작품인데 mediaUrl이 비어 있어요.",
    "외부 링크 작품인데 externalUrl 또는 mediaUrl이 비어 있어요.",
    "HTML 작품인데 mediaUrl 또는 externalUrl이 비어 있어요.",
  ]);
});

test("reports privacy hints with conservative phone, email, school, grade, class, and name labels", () => {
  const result = inspectStudentGalleryExportItems([
    galleryItem({
      title: "우리 학교 전시",
      author: "이름: 홍길동",
      summary: "3학년 2반 프로젝트",
      cardText: "연락처 010-1234-5678, 메일 hello@example.com, 실명 확인",
    }),
  ]);

  const [privacyMessage] = messagesByKind(result.issues, "privacy");
  assert.match(privacyMessage ?? "", /전화번호처럼 보이는 숫자/);
  assert.match(privacyMessage ?? "", /이메일 주소/);
  assert.match(privacyMessage ?? "", /학교/);
  assert.match(privacyMessage ?? "", /학년/);
  assert.match(privacyMessage ?? "", /반/);
  assert.match(privacyMessage ?? "", /실명/);
  assert.match(privacyMessage ?? "", /이름:/);
});

test("does not flag class keyword inside unrelated Korean words", () => {
  const result = inspectStudentGalleryExportItems([
    galleryItem({
      title: "반짝이는 우주",
      summary: "빛이 반짝이는 장면입니다.",
      cardText: "작품 소개: 빛이 반짝이는 장면입니다.",
    }),
  ]);

  assert.equal(messagesByKind(result.issues, "privacy").length, 0);
});

test("reports external link guidance and duplicate titles", () => {
  const result = inspectStudentGalleryExportItems([
    galleryItem({
      title: "같은 제목",
      type: "external-link",
      imageUrl: "",
      mediaUrl: "https://example.com/a",
      externalUrl: "https://example.com/a",
      cardText: "외부 작품 링크: https://example.com/a",
    }),
    galleryItem({
      title: " 같은   제목 ",
      cardText: "작품 소개: 링크는 없어요.",
    }),
  ]);

  assert.deepEqual(messagesByKind(result.issues, "link"), [
    "외부 링크 작품은 공유 권한과 내용 적합성을 확인해 주세요.",
  ]);
  assert.deepEqual(messagesByKind(result.issues, "duplicate"), [
    "같은 제목의 작품이 여러 개 있어요.",
    "같은 제목의 작품이 여러 개 있어요.",
  ]);
});

test("returns gentle clear summary when no issues are found", () => {
  const result = inspectStudentGalleryExportItems([galleryItem()]);

  assert.equal(result.affectedArtworkCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(
    result.summary,
    "점검 결과: 큰 문제는 보이지 않아요. 배포 전 개인정보와 링크를 한 번 더 확인해 주세요.",
  );
});
