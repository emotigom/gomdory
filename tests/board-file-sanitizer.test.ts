import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeBoardFilename } from "@/lib/data/boardFiles";

test("sanitizeBoardFilename removes unsafe characters and trims", () => {
  const raw = "../../my weird file 😎.png";
  const result = sanitizeBoardFilename(raw);
  assert.equal(result, "my_weird_file_.png");
});

test("sanitizeBoardFilename limits length", () => {
  const longName = `${"a".repeat(300)}.txt`;
  const result = sanitizeBoardFilename(longName);
  assert.ok(result.length <= 200, "filename should be truncated");
});
