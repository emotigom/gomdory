import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeExhibitPayload, sanitizeExhibitText, EXHIBIT_LIMITS } from "@/lib/exhibit/sanitize";
import type { ExhibitPayload } from "@/lib/exhibit/types";

test("sanitizeExhibitText masks urls, pii, and tokens", () => {
  const raw =
    "학생 이메일 teacher@example.com 링크 https://example.com 토큰 abcdefghijklmnopqrstuvwxyz";
  const sanitized = sanitizeExhibitText(raw, 200);
  assert.ok(sanitized);
  assert.equal(sanitized?.includes("example.com"), false);
  assert.equal(sanitized?.includes("teacher@example.com"), false);
  assert.equal(sanitized?.includes("abcdefghijklmnopqrstuvwxyz"), false);
});

test("sanitizeExhibitPayload limits highlights and preview length", () => {
  const longText = "내용".repeat(200);
  const payload: ExhibitPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    board: { title: "전시", layout: "gallery", counts: { cards: 0, columns: 0 } },
    highlights: Array.from({ length: EXHIBIT_LIMITS.highlights + 10 }, (_, index) => ({
      type: "card",
      title: `카드 ${index}`,
      textPreview: longText,
      kind: "idea",
    })),
    aggregates: { questionsCount: 0, helpCount: 0 },
    timeline: [],
    notes: {},
  };

  const sanitized = sanitizeExhibitPayload(payload);
  assert.ok(sanitized.highlights.length <= EXHIBIT_LIMITS.highlights);
  assert.ok(sanitized.highlights.every((item) => item.textPreview.length <= EXHIBIT_LIMITS.textPreview));
});
