import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeTemplatePayload } from "@/lib/templates/sanitize";

test("sanitizeTemplatePayload strips sensitive fields", () => {
  const payload = sanitizeTemplatePayload(
    {
      board: { title: "안전한 보드", board_view_type: "grid" },
      walls: [{ id: "wall-1", title: "담벼락" }],
      cards: [
        { wall_id: "wall-1", author_type: "teacher", text: "토론 주제" },
        {
          wall_id: "wall-1",
          author_type: "teacher",
          external_attachments: [{ filename: "파일", contentType: "text/plain", byteSize: 12 }],
        },
      ],
    },
    { title: "커뮤니티 템플릿", tags: ["토론", "브레인스토밍"] },
  );

  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("session"));
  assert.ok(!serialized.includes("object_key"));
});

test("sanitizeTemplatePayload neutralizes PII in template text", () => {
  const payload = sanitizeTemplatePayload(
    {
      board: { title: "보드", board_view_type: "grid" },
      walls: [{ id: "wall-1", title: "담벼락" }],
      cards: [{ wall_id: "wall-1", author_type: "teacher", text: "contact me at test@example.com" }],
    },
    { title: "커뮤니티 템플릿" },
  );

  assert.equal(payload.board.cards.length, 1);
  assert.equal(payload.board.cards[0]?.type, "text");
  assert.equal(payload.board.cards[0]?.text, "contact me at t***@e***.com");
  assert.ok(!payload.board.cards[0]?.text?.includes("test@example.com"));
});
