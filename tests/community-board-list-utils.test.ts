import assert from "node:assert/strict";
import test from "node:test";

import { clampAttachmentChips, normalizeCommunitySearch } from "@/lib/community/boardList";

test("clampAttachmentChips returns first chips and hidden count", () => {
  const result = clampAttachmentChips(["a", "b", "c", "d"], 3);
  assert.deepEqual(result, { visible: ["a", "b", "c"], hiddenCount: 1 });
});

test("clampAttachmentChips supports zero visible size", () => {
  const result = clampAttachmentChips([1, 2], 0);
  assert.deepEqual(result, { visible: [], hiddenCount: 2 });
});

test("normalizeCommunitySearch trims, lowercases and compacts whitespace", () => {
  assert.equal(normalizeCommunitySearch("  Hello   WoRLD  "), "hello world");
});

test("normalizeCommunitySearch applies unicode normalization", () => {
  assert.equal(normalizeCommunitySearch("ＡＢＣ"), "abc");
});
