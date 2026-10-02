import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("upload intent loads card through canonical card helper", () => {
  const source = readFileSync("lib/data/files.ts", "utf8");
  assert.match(source, /loadCardForUpload/);
  assert.doesNotMatch(source, /select\("id, owner_id, board_id"\)/);
});

test("upload intent authorizes with board membership for canonical board cards", () => {
  const source = readFileSync("lib/data/files.ts", "utf8");
  assert.match(source, /rpc\("board_role"/);
  assert.doesNotMatch(source, /from\("board_members"\)/);
  assert.match(source, /authorize_card_upload/);
});
