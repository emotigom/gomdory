import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("ui-prefs route normalizes and merges hasDismissedNewBoardOnboarding as camelCase", () => {
  const source = read("app", "api", "v1", "me", "ui-prefs", "route.ts");

  assert.match(source, /hasDismissedNewBoardOnboarding\?: boolean/);
  assert.match(source, /normalizeHasDismissedNewBoardOnboarding\(input\?\.hasDismissedNewBoardOnboarding\)/);
  assert.match(source, /hasDismissedNewBoardOnboarding: false/);
  assert.doesNotMatch(source, /has_dismissed_new_board_onboarding/);
});
