import assert from "node:assert/strict";
import test from "node:test";

import { normalizeHttpUrl, removeCardUrlAttachment, upsertCardUrlAttachment } from "@/lib/cards/urlAttachment";

test("normalizeHttpUrl accepts only http/https", () => {
  assert.equal(normalizeHttpUrl("https://example.com/path?q=1"), "https://example.com/path?q=1");
  assert.equal(normalizeHttpUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeHttpUrl("ftp://example.com"), null);
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("example.com"), null);
});

test("upsertCardUrlAttachment keeps files and replaces link", () => {
  const existing = [
    { filename: "a.txt", downloadPath: "https://cdn.example.com/a.txt" },
    { kind: "link", url: "https://old.example.com", filename: "old" },
  ];

  const updated = upsertCardUrlAttachment(existing, "https://new.example.com/room");

  assert.equal(updated.length, 2);
  assert.equal(updated[0]?.filename, "a.txt");
  assert.equal(updated[1]?.kind, "link");
  assert.equal(updated[1]?.url, "https://new.example.com/room");
});

test("upsertCardUrlAttachment removes link when url is null", () => {
  const existing = [
    { filename: "a.txt", downloadPath: "https://cdn.example.com/a.txt" },
    { kind: "link", url: "https://old.example.com", filename: "old" },
  ];

  const updated = upsertCardUrlAttachment(existing, null);

  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.filename, "a.txt");
});


test("removeCardUrlAttachment removes only the matching link", () => {
  const existing = [
    { filename: "a.txt", downloadPath: "https://cdn.example.com/a.txt" },
    { kind: "link", url: "https://one.example.com", filename: "one" },
    { kind: "link", url: "https://two.example.com", filename: "two" },
  ];

  const updated = removeCardUrlAttachment(existing, "https://one.example.com");

  assert.equal(updated.length, 2);
  assert.equal(updated[0]?.filename, "a.txt");
  assert.equal(updated[1]?.url, "https://two.example.com");
});
