import assert from "node:assert/strict";
import test from "node:test";

import { summarizeStudentSubmissions } from "@/lib/board/studentSubmissionSummary";

test("student submission summary counts active student cards and attachments", () => {
  const summary = summarizeStudentSubmissions([
    {
      wall: { id: "ideas", title: "아이디어" },
      cards: [
        { id: "student-1", author_type: "student", author_name: "민지", text: "작품 A", created_at: "2026-06-20T00:00:00Z", attachments: [{}] },
        { id: "student-2", author_type: "student", author_name: null, text: "작품 B", created_at: "2026-06-21T00:00:00Z", attachments: [] },
        { id: "teacher-1", author_type: "teacher", author_name: "교사", text: "안내", attachments: [{}] },
        { id: "deleted", author_type: "student", author_name: "삭제", text: "삭제됨", deleted_at: "2026-06-21T00:00:00Z", attachments: [{}] },
      ],
    },
  ]);

  assert.equal(summary.studentCardCount, 2);
  assert.equal(summary.studentCardWithAttachmentsCount, 1);
  assert.equal(summary.recentCards[0]?.cardId, "student-2");
  assert.equal(summary.recentCards[0]?.authorLabel, "익명 학생");
  assert.equal(summary.submittedStudents?.length, 2);
  assert.equal(summary.submittedStudents?.[0]?.authorLabel, "민지");
});

test("student submission summary preserves author client id as the primary draw identity", () => {
  const summary = summarizeStudentSubmissions([
    {
      wall: { id: "artwork", title: "작품 올리기" },
      cards: [
        {
          id: "card-a",
          author_type: "student",
          author_client_id: "client-123",
          author_name: "민지",
          text: "첫 제출",
          created_at: "2026-06-20T00:00:00Z",
          attachments: [],
        },
        {
          id: "card-b",
          author_type: "student",
          author_client_id: "client-123",
          author_name: "민지 수정",
          text: "두 번째 제출",
          created_at: "2026-06-21T00:00:00Z",
          attachments: [],
        },
      ],
    },
  ]);

  assert.equal(summary.submittedStudents?.length, 2);
  assert.equal(summary.submittedStudents?.[0]?.id, "client-123");
  assert.equal(summary.submittedStudents?.[0]?.authorClientId, "client-123");
  assert.equal(summary.submittedStudents?.[1]?.id, "client-123");
});

test("student submission summary gives anonymous students card-based fallback ids", () => {
  const summary = summarizeStudentSubmissions([
    {
      wall: { id: "artwork", title: "작품 올리기" },
      cards: [
        { id: "blank-a", author_type: "student", author_name: "", text: "A", attachments: [] },
        { id: "blank-b", author_type: "student", author_name: null, text: "B", attachments: [] },
      ],
    },
  ]);

  assert.deepEqual(summary.submittedStudents?.map((student) => student.id), ["blank-a", "blank-b"]);
});

test("preferred artwork columns come first and recent list is limited to five", () => {
  const ordinaryCards = Array.from({ length: 6 }, (_, index) => ({
    id: `ordinary-${index}`,
    author_type: "student" as const,
    author_name: `학생 ${index}`,
    text: `일반 작품 ${index}`,
    created_at: `2026-06-2${index}T00:00:00Z`,
    attachments: [],
  }));
  const summary = summarizeStudentSubmissions([
    { wall: { id: "ordinary", title: "자유 게시판" }, cards: ordinaryCards },
    {
      wall: { id: "artwork", title: "내가 만든 작품 모음" },
      cards: [{ id: "preferred", author_type: "student", author_name: "하늘", text: "선호 작품", created_at: "2026-06-01T00:00:00Z", attachments: [{}, {}] }],
    },
  ]);

  assert.equal(summary.recentCards.length, 5);
  assert.equal(summary.recentCards[0]?.cardId, "preferred");
  assert.equal(summary.recentCards[0]?.wallTitle, "내가 만든 작품 모음");
  assert.equal(summary.recentCards[0]?.attachmentCount, 2);
});

test("final artwork summary classifies image video audio and external links", () => {
  const summary = summarizeStudentSubmissions([
    {
      wall: { id: "final", title: "최종 작품" },
      cards: [
        {
          id: "final-1",
          author_type: "student",
          author_name: "지우",
          text: "작품 제목\nhttps://example.com/showcase",
          created_at: "2026-06-22T00:00:00Z",
          tags: [{ name: "최종 작품" }],
          attachments: [
            { label: "cover.png", url: "/files/cover.png", contentType: "image/png" },
            { label: "video.mp4", url: "/files/video.mp4", contentType: null },
            { label: "song.mp3", url: "/files/song.mp3", contentType: null },
            { kind: "url", label: "공유 링크", url: "https://example.com/shared-work" },
          ],
        },
      ],
    },
  ]);

  const artwork = summary.finalArtworkCards[0];
  assert.equal(summary.finalArtworkRichMediaCount, 1);
  assert.equal(artwork?.representativeImage?.label, "cover.png");
  assert.equal(artwork?.videoAttachment?.label, "video.mp4");
  assert.equal(artwork?.audioAttachment?.label, "song.mp3");
  assert.equal(artwork?.htmlAttachment, null);
  assert.equal(artwork?.cardText, "작품 제목\nhttps://example.com/showcase");
  assert.deepEqual(artwork?.externalLinks, [
    "https://example.com/showcase",
    "https://example.com/shared-work",
  ]);
  assert.deepEqual(artwork?.badgeLabels, ["이미지", "영상", "음악", "외부 링크", "첨부 있음"]);
});

test("final artwork summary classifies html attachments", () => {
  const summary = summarizeStudentSubmissions([
    {
      wall: { id: "final", title: "최종 작품" },
      cards: [
        {
          id: "html-1",
          author_type: "student",
          author_name: "서연",
          text: "HTML 작품",
          created_at: "2026-06-22T00:00:00Z",
          tags: [{ name: "최종 작품" }],
          attachments: [{ label: "index.html", url: "/apps/demo/index.html", contentType: "text/html" }],
        },
      ],
    },
  ]);

  const artwork = summary.finalArtworkCards[0];
  assert.equal(artwork?.htmlAttachment?.label, "index.html");
  assert.deepEqual(artwork?.mediaTypes, ["html"]);
  assert.deepEqual(artwork?.badgeLabels, ["HTML/웹앱", "첨부 있음"]);
});
