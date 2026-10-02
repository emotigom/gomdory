import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("ui-prefs route persists dashboard board prefs as camelCase DTO fields", () => {
  const source = read("app", "api", "v1", "me", "ui-prefs", "route.ts");

  assert.match(source, /lastOpenedBoardId\?: string \| null/);
  assert.match(source, /normalizeLastOpenedBoardId\(input\?\.lastOpenedBoardId\)/);
  assert.match(source, /pinnedBoardIds\?: string\[]/);
  assert.match(source, /normalizePinnedBoardIds\(input\?\.pinnedBoardIds\)/);
  assert.match(source, /folders\?: DashboardFolder\[]/);
  assert.match(source, /boardFolderMap\?: BoardFolderMap/);
  assert.match(source, /normalizeFolders\(input\?\.folders\)/);
  assert.match(source, /normalizeBoardFolderMap\(input\?\.boardFolderMap, normalizeFolders\(input\?\.folders\)\)/);
  assert.doesNotMatch(source, /last_opened_board_id/);
  assert.doesNotMatch(source, /pinned_board_ids/);
  assert.doesNotMatch(source, /board_folder_map/);
});
