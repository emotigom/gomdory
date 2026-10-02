import assert from "node:assert/strict";
import test from "node:test";

import { boardClassHref, boardHubHref } from "@/lib/dashboard/boardHrefs";

test("boardHubHref returns the dashboard board hub path", () => {
  assert.equal(boardHubHref("abc-123"), "/dashboard/boards/abc-123");
});

test("boardClassHref returns the dashboard class path", () => {
  assert.equal(boardClassHref("abc-123"), "/dashboard/boards/abc-123/class");
});
