import test from "node:test";
import assert from "node:assert/strict";

import { buildCardSelector, resolveCardAnchor } from "@/lib/board/scrollToCard";

test("buildCardSelector creates selectors for data-card-id and id anchor", () => {
  assert.equal(buildCardSelector("card-123"), '[data-card-id="card-123"],#card-123');
});

test("buildCardSelector escapes quotes and backslashes", () => {
  assert.equal(buildCardSelector('id"\\x'), '[data-card-id="id\\"\\\\x"],#id\\"\\\\x');
});

test("resolveCardAnchor prefers query card parameter", () => {
  assert.equal(resolveCardAnchor("https://example.com/board?card=card-77#legacy"), "card-77");
});
