import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeText } from "@/lib/safety/sanitizeText";

test("sanitizeText removes control characters and zero-width chars", () => {
  const input = "hi\u200b\u0007there";
  const result = sanitizeText(input, { maxLength: 100 });
  assert.equal(result.text, "hithere");
  assert.ok(result.flags.includes("control_chars"));
});

test("sanitizeText truncates long text", () => {
  const input = "a".repeat(20);
  const result = sanitizeText(input, { maxLength: 10 });
  assert.equal(result.text.length, 4);
  assert.ok(result.flags.includes("spammy"));
  assert.ok(!result.flags.includes("truncated"));
});

test("sanitizeText clamps spammy repeats and whitespace", () => {
  const input = "우와!!!!!!   \n\n\n좋아요";
  const result = sanitizeText(input, { maxLength: 100 });
  assert.ok(result.flags.includes("spammy"));
  assert.ok(!result.text.includes("\n\n\n"));
});
