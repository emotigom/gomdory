import assert from "node:assert/strict";
import test from "node:test";

import { showcaseToTemplate } from "@/lib/showcase/showcaseToTemplate";
import type { ShowcaseSummary } from "@/lib/showcase/buildShowcaseSummary";

const summary: ShowcaseSummary = {
  version: 1,
  generatedAt: new Date().toISOString(),
  board: { title: "테스트 수업 test@example.com" },
  stats: {
    participantsApprox: 12,
    questionsCount: 5,
    helpCount: 2,
    pollsCount: 1,
  },
  highlights: [
    {
      type: "clip",
      title: "핵심 장면",
      thumbUrl: "https://cdn.example.com/highlight.png",
      safeText: null,
      at: null,
    },
    {
      type: "clip",
      title: "내부 링크",
      thumbUrl: "http://localhost/private.png",
      safeText: null,
      at: null,
    },
  ],
  topQuestions: [
    { text: "질문: 연락처 010-1234-5678", pinned: true },
    { text: "왜 이런 결과가 나왔나요?" },
  ],
  teacherNotes: null,
};

test("showcaseToTemplate builds a safe template payload", () => {
  const payload = showcaseToTemplate(summary);
  const serialized = JSON.stringify(payload);

  assert.ok(serialized.includes("수업 목표/흐름"));
  assert.ok(serialized.includes("오늘의 핵심 결과"));
  assert.ok(!serialized.includes("test@example.com"));
  assert.ok(!serialized.includes("010-1234-5678"));
  assert.ok(!serialized.includes("localhost"));
  assert.ok(payload.cards.length >= 4);

  const hasAttachment = payload.cards.some(
    (card) => card.kind === "attachment" && card.attachment.downloadPath === "https://cdn.example.com/highlight.png",
  );
  assert.equal(hasAttachment, true);
});
