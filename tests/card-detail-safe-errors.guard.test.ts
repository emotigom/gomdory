import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("card detail overlay sanitizes server errors", async () => {
  const source = await readFile("app/_components/CardDetailOverlay.tsx", "utf8");

  assert.match(source, /safeErrorMessage\(/);
  assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
});
