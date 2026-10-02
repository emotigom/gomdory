import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBookmarkNote } from "@/lib/data/sessionBookmarks";

test("normalizeBookmarkNote trims and limits length", () => {
  const note = "   중요한 순간 정리   ";
  assert.equal(normalizeBookmarkNote(note), "중요한 순간 정리");

  const longNote = "a".repeat(300);
  const normalized = normalizeBookmarkNote(longNote);
  assert.equal(normalized?.length, 200);
});

test("normalizeBookmarkNote handles empty inputs", () => {
  assert.equal(normalizeBookmarkNote("   "), null);
  assert.equal(normalizeBookmarkNote(null), null);
  assert.equal(normalizeBookmarkNote(undefined), null);
});
