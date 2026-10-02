import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import StudentSubmissionStatusPanel from "@/app/dashboard/boards/[boardId]/board/_components/StudentSubmissionStatusPanel";

test("teacher submission status panel renders counts and recent card metadata", () => {
  const html = renderToStaticMarkup(
    <StudentSubmissionStatusPanel
      summary={{
        studentCardCount: 3,
        studentCardWithAttachmentsCount: 2,
        finalArtworkRichMediaCount: 0,
        recentCards: [{ cardId: "card-1", wallId: "wall-1", wallTitle: "작품 올리기", authorLabel: "익명 학생", attachmentCount: 2, title: "나의 AI 그림", createdAt: "2026-06-22T00:00:00Z", isFinalArtwork: false }],
        finalArtworkCards: [],
        submittedStudents: [{ id: "student-1", authorLabel: "익명 학생", cardId: "card-1", wallTitle: "작품 올리기", createdAt: "2026-06-22T00:00:00Z", isFinalArtwork: false }],
      }}
      onSelectCard={() => undefined}
    />,
  );

  assert.match(html, /작품 제출 현황/);
  assert.match(html, /학생 카드/);
  assert.match(html, /첨부 있음/);
  assert.match(html, /나의 AI 그림/);
  assert.match(html, /익명 학생/);
  assert.match(html, /첨부 2개/);
  assert.match(html, /작품 올리기/);
  assert.match(html, /추첨게임/);
  assert.match(html, /title="제출한 친구들로 바로 추첨해요"/);
  const drawButton = html.match(/<button[^>]*title="제출한 친구들로 바로 추첨해요"[^>]*>/)?.[0] ?? "";
  assert.doesNotMatch(drawButton, /disabled=""/);
  assert.doesNotMatch(html, /제출한 학생이 생기면 추첨게임/);
  assert.match(html, /aria-expanded="true"/);
});

test("teacher submission status panel disables draw game without submitted students", () => {
  const html = renderToStaticMarkup(
    <StudentSubmissionStatusPanel
      summary={{
        studentCardCount: 0,
        studentCardWithAttachmentsCount: 0,
        finalArtworkRichMediaCount: 0,
        recentCards: [],
        finalArtworkCards: [],
        submittedStudents: [],
      }}
      onSelectCard={() => undefined}
    />,
  );

  assert.match(html, /추첨게임/);
  assert.match(html, /disabled=""/);
  assert.match(html, /제출한 학생이 생기면 추첨게임을 바로 열 수 있어요/);
});

test("teacher submission status panel keeps clipboard failure guidance", () => {
  const source = fs.readFileSync(
    "app/dashboard/boards/[boardId]/board/_components/StudentSubmissionStatusPanel.tsx",
    "utf8",
  );

  assert.match(source, /typeof navigator === "undefined"/);
  assert.match(source, /복사에 실패했어요\. 결과를 직접 선택해 복사해 주세요\./);
  assert.match(source, /typeof window === "undefined" \|\| typeof window\.matchMedia !== "function"/);
});
