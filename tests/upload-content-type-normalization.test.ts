import assert from "node:assert/strict";
import test from "node:test";

import { normalizeUploadContentType } from "@/lib/uploads/contentType";

test("normalizes text/plain charset and extension fallbacks", () => {
  assert.equal(normalizeUploadContentType({ contentType: "text/plain; charset=utf-8", filename: "a.txt" }), "text/plain");
  assert.equal(normalizeUploadContentType({ contentType: "application/octet-stream", filename: "a.txt" }), "text/plain");
  assert.equal(normalizeUploadContentType({ contentType: "", filename: "a.txt" }), "text/plain");
  assert.equal(normalizeUploadContentType({ contentType: "", filename: "a.log" }), "text/plain");
  assert.equal(normalizeUploadContentType({ contentType: "", filename: "a.md" }), "text/markdown");
  assert.equal(normalizeUploadContentType({ contentType: "", filename: "a.csv" }), "text/csv");
  assert.equal(normalizeUploadContentType({ contentType: "", filename: "a.json" }), "application/json");
  assert.equal(normalizeUploadContentType({ contentType: "", filename: "a.unknown" }), "application/octet-stream");
});
