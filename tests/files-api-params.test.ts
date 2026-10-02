import assert from "node:assert/strict";
import test from "node:test";

import { parseFilesListParams } from "@/lib/api/files/listParams";

test("parseFilesListParams allows empty params with defaults", () => {
  const params = parseFilesListParams(new URLSearchParams());

  assert.equal(params.q, null);
  assert.equal(params.tag, null);
  assert.equal(params.cursor, null);
  assert.equal(params.limit, 24);
  assert.equal(params.sort, "recent");
});

test("parseFilesListParams clamps limit", () => {
  const params = parseFilesListParams(new URLSearchParams({ limit: "100" }));

  assert.equal(params.limit, 60);
});
