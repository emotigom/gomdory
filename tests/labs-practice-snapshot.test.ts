import test from "node:test";
import assert from "node:assert/strict";

import {
  PRACTICE_SNAPSHOT_LIMITS,
  createPracticeSnapshotAttachment,
  normalizePracticeSnapshotAttachment,
} from "@/lib/labs/practiceSnapshot";

test("practice snapshot shape is normalized", () => {
  const created = createPracticeSnapshotAttachment({
    title: "제목",
    html: "<h1>Hi</h1>",
    css: "h1{color:red}",
    js: "console.log(1)",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(created.kind, "practice");
  assert.equal(created.title, "제목");
  assert.equal(created.createdAt, "2026-01-01T00:00:00.000Z");
});

test("practice snapshot caps each field", () => {
  const attachment = normalizePracticeSnapshotAttachment({
    kind: "practice",
    title: "t".repeat(PRACTICE_SNAPSHOT_LIMITS.title + 20),
    html: "h".repeat(PRACTICE_SNAPSHOT_LIMITS.html + 30),
    css: "c".repeat(PRACTICE_SNAPSHOT_LIMITS.css + 30),
    js: "j".repeat(PRACTICE_SNAPSHOT_LIMITS.js + 30),
    createdAt: "invalid-date",
  });

  assert.ok(attachment);
  assert.equal(attachment?.title.length, PRACTICE_SNAPSHOT_LIMITS.title);
  assert.equal(attachment?.html.length, PRACTICE_SNAPSHOT_LIMITS.html);
  assert.equal(attachment?.css.length, PRACTICE_SNAPSHOT_LIMITS.css);
  assert.equal(attachment?.js.length, PRACTICE_SNAPSHOT_LIMITS.js);
  assert.ok(typeof attachment?.createdAt === "string");
});
