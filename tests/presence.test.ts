import assert from "node:assert/strict";
import test from "node:test";

import { isWithinActiveWindow, normalizeDisplayName } from "@/lib/data/presence";

test("normalizeDisplayName trims and collapses whitespace", () => {
  const input = "  지우   학생  ";
  assert.equal(normalizeDisplayName(input), "지우 학생");
});

test("normalizeDisplayName removes disallowed characters and limits length", () => {
  const input = "Hello😀World!!!";
  assert.equal(normalizeDisplayName(input), "HelloWorld!!");

  const long = "가나다라마바사아자차카타파하"; // 14 chars
  assert.equal(normalizeDisplayName(long), "가나다라마바사아자차카타");
});

test("normalizeDisplayName returns null for empty values", () => {
  assert.equal(normalizeDisplayName("    "), null);
  assert.equal(normalizeDisplayName("😀😀"), null);
});

test("isWithinActiveWindow checks active window", () => {
  const now = Date.now();
  assert.equal(isWithinActiveWindow(new Date(now - 30_000), now, 90), true);
  assert.equal(isWithinActiveWindow(new Date(now - 200_000), now, 90), false);
});
