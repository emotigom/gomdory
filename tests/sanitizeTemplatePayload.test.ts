import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeTemplatePayload, type TemplateBoardExport } from "@/lib/templates/sanitizeTemplatePayload";

test("sanitizeTemplatePayload removes forbidden keys and student cards", () => {
  const input = {
    board: {
      title: "보드 템플릿",
      description: "설명",
      board_view_type: "grid",
      view_defaults: {
        studentDefaultView: "gallery",
        sessionId: "session-1",
      },
      roster: "hidden",
    },
    walls: [
      { id: "wall-1", title: "첫 담벼락" },
      { id: "wall-2", title: "둘째 담벼락" },
    ],
    cards: [
      { wall_id: "wall-1", author_type: "student", text: "학생 카드" },
      { wall_id: "wall-1", author_type: "teacher", text: "교사 카드" },
    ],
  } as unknown as TemplateBoardExport;

  const payload = sanitizeTemplatePayload(input);

  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("session"));
  assert.ok(!serialized.includes("roster"));
  assert.equal(payload.cards.length, 1);
  assert.equal(payload.cards[0].kind, "text");
});

test("sanitizeTemplatePayload clamps text length", () => {
  const longText = "A".repeat(800);
  const payload = sanitizeTemplatePayload({
    board: { title: "보드 템플릿" },
    walls: [{ id: "wall-1", title: "담벼락" }],
    cards: [{ wall_id: "wall-1", author_type: "teacher", text: longText }],
  });

  const card = payload.cards[0];
  if (card.kind !== "text") {
    throw new Error("expected text card");
  }
  assert.equal(card.text.length, 4);
  assert.equal(payload.meta.payloadVersion, 1);
});
