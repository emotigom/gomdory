import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync("app/api/v1/dashboard/boards/[boardId]/walls/reorder/route.ts", "utf8");

test("dashboard wall reorder only updates existing wall positions", () => {
  assert.doesNotMatch(source, /\.upsert\s*\(/, "reorder must not upsert walls");
  assert.doesNotMatch(source, /\.insert\s*\(/, "reorder must not insert walls");
  assert.match(source, /\.update\s*\(\s*\{\s*position:\s*update\.position\s*\}\s*\)/);
  assert.doesNotMatch(source, /\.update\s*\(\s*\{[\s\S]*title:/, "reorder must not update wall titles");
});

test("dashboard wall reorder validates requested wall ownership before updating", () => {
  assert.match(source, /\.eq\s*\(\s*"board_id"\s*,\s*board\.id\s*\)/);
  assert.match(source, /\.eq\s*\(\s*"owner_id"\s*,\s*user\.id\s*\)/);
  assert.match(source, /\.in\s*\(\s*"id"\s*,\s*wallIds\s*\)/);
  assert.match(source, /existingIds\.size\s*!==\s*wallIds\.length/);
});
