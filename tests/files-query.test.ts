import assert from "node:assert/strict";
import test from "node:test";

import { parseFilesListParams } from "@/lib/api/files/listParams";
import { normalizeFileTags } from "@/lib/files/normalizeTags";

test("parseFilesListParams falls back to safe defaults", () => {
  const params = parseFilesListParams(
    new URLSearchParams({
      limit: "-5",
      sort: "weird",
      type: "unknown",
      boardId: "  ",
      q: "   ",
    }),
  );

  assert.equal(params.limit, 1);
  assert.equal(params.sort, "recent");
  assert.equal(params.type, "any");
  assert.equal(params.boardId, null);
  assert.equal(params.q, null);
});

test("normalizeFileTags applies rules and limits", () => {
  const { tags, invalid } = normalizeFileTags([
    "  Hello World ",
    "Hello  World",
    "Tag/One",
    "Comma,Tag",
    "  ",
  ]);

  assert.deepEqual(tags, ["hello-world", "tagone", "commatag"]);
  assert.equal(invalid, true);
});
