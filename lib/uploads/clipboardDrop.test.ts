import assert from "node:assert/strict";
import test from "node:test";

import { extractAttachmentsFromDrop, extractUrlFromPaste } from "@/lib/uploads/clipboardDrop";

test("extractAttachmentsFromDrop returns files from transfer-like object", () => {
  const fileA = new File(["a"], "a.txt", { type: "text/plain" });
  const fileB = new File(["b"], "b.png", { type: "image/png" });

  const result = extractAttachmentsFromDrop({ files: { 0: fileA, 1: fileB, length: 2 } });

  assert.equal(result.length, 2);
  assert.equal(result[0], fileA);
  assert.equal(result[1], fileB);
});

test("extractAttachmentsFromDrop handles empty transfer", () => {
  assert.deepEqual(extractAttachmentsFromDrop(null), []);
  assert.deepEqual(extractAttachmentsFromDrop({ files: null }), []);
});

test("extractUrlFromPaste normalizes valid http/https URLs", () => {
  assert.equal(extractUrlFromPaste(" https://example.com/path?q=1 "), "https://example.com/path?q=1");
  assert.equal(extractUrlFromPaste("http://example.com"), "http://example.com/");
});

test("extractUrlFromPaste rejects non-http URLs and text", () => {
  assert.equal(extractUrlFromPaste("ftp://example.com"), null);
  assert.equal(extractUrlFromPaste("hello world"), null);
});
