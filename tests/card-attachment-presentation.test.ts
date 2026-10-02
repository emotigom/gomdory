import assert from "node:assert/strict";
import test from "node:test";

import { classifyAttachment, formatFileChipLabel } from "@/lib/cards/attachmentPresentation";

test("classifyAttachment returns image for image mime", () => {
  assert.equal(classifyAttachment({ contentType: "image/png", name: "doc.pdf" }), "image");
});

test("classifyAttachment returns image for image extension fallback", () => {
  assert.equal(classifyAttachment({ contentType: "", name: "photo.jpeg" }), "image");
});

test("classifyAttachment returns file for non-image", () => {
  assert.equal(classifyAttachment({ contentType: "application/pdf", name: "lesson.pdf" }), "file");
});

test("formatFileChipLabel splits extension", () => {
  assert.deepEqual(formatFileChipLabel("lesson.plan.pptx"), { base: "lesson.plan", ext: "PPTX" });
});

test("formatFileChipLabel handles missing extension", () => {
  assert.deepEqual(formatFileChipLabel("readme"), { base: "readme", ext: "FILE" });
});

test("formatFileChipLabel handles long names with extension", () => {
  const long = "아주긴파일이름".repeat(12) + ".pdf";
  const result = formatFileChipLabel(long);
  assert.equal(result.ext, "PDF");
  assert.equal(result.base.endsWith(".pdf"), false);
  assert.ok(result.base.length > 10);
});

test("formatFileChipLabel handles empty name", () => {
  assert.deepEqual(formatFileChipLabel("   "), { base: "첨부파일", ext: "FILE" });
});
