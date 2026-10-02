import assert from "node:assert/strict";
import test from "node:test";

import { buildExternalAttachments } from "@/lib/student/externalAttachments";

test("buildExternalAttachments keeps safe external links", () => {
  const attachments = [
    { id: "1", type: "external", url: "https://example.com", label: "Example" },
    { id: "2", type: "external", url: "/edu/lesson", label: "Lesson" },
  ];

  const result = buildExternalAttachments(attachments);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { kind: "link", url: "https://example.com", filename: "Example" });
  assert.deepEqual(result[1], { kind: "link", url: "/edu/lesson", filename: "Lesson" });
});

test("buildExternalAttachments drops unsafe urls", () => {
  const attachments = [
    { id: "1", type: "external", url: "javascript:alert(1)", label: "Bad" },
    { id: "2", type: "external", url: "ftp://example.com", label: "FTP" },
  ];

  const result = buildExternalAttachments(attachments);

  assert.equal(result.length, 0);
});
