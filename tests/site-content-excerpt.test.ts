import assert from "node:assert/strict";
import test from "node:test";

import { makeExcerpt } from "@/lib/site-content/excerpt";

test("makeExcerpt normalizes whitespace and keeps punctuation", () => {
  const value = makeExcerpt("  첫 문장.\n\n\n둘째   문장!\r\n\t셋째?  ");
  assert.equal(value, "첫 문장.\n\n둘째 문장!\n셋째?");
});

test("makeExcerpt truncates and appends ellipsis", () => {
  const value = makeExcerpt("1234567890 ABCDE", 10);
  assert.equal(value, "1234567890…");
});
