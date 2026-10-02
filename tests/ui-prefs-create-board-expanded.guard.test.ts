import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("ui-prefs route normalizes and merges isCreateBoardExpanded as camelCase", () => {
  const source = read("app", "api", "v1", "me", "ui-prefs", "route.ts");

  assert.match(source, /isCreateBoardExpanded\?: boolean/);
  assert.match(source, /typeof input\?\.isCreateBoardExpanded === "boolean"/);
  assert.match(source, /DEFAULT_CLASS_PREFS\.isCreateBoardExpanded/);
  assert.match(source, /\.\.\.incomingPrefs,/);
  assert.doesNotMatch(source, /is_create_board_expanded/);
});
