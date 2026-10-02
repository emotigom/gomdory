import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard card move route derives board ownership from card->wall->board and allows editable role fallback", () => {
  const source = read("app", "api", "v1", "dashboard", "cards", "[cardId]", "move", "route.ts");
  assert.match(source, /loadCardForUpload\(\{ supabase, cardId \}\)/);
  assert.match(source, /const isOwner = boardOwnerId === user\.id/);
  assert.match(source, /canEditBoard\(role\)/);
  assert.doesNotMatch(source, /if \(role !== "owner"\)/);
});

test("dashboard card move route no longer requires client boardId and no longer enforces card owner_id on update", () => {
  const source = read("app", "api", "v1", "dashboard", "cards", "[cardId]", "move", "route.ts");
  assert.doesNotMatch(source, /boardId 값이 필요합니다/);
  assert.doesNotMatch(source, /\.eq\("owner_id", user\.id\)/);
  assert.match(source, /moveCardAndNormalizePositions\(\{/);
  assert.match(source, /\.select\("id, wall_id, position, created_at"\)/);
  assert.match(source, /\.update\(toSnakeKeys\(\{ wallId, position: index, updatedAt: nowIso \}\)\)/);
});

test("dashboard card move route normalizes affected wall card positions without card upsert", () => {
  const source = read("app", "api", "v1", "dashboard", "cards", "[cardId]", "move", "route.ts");
  assert.match(source, /buildNormalizedCardMove\(\{/);
  assert.match(source, /for \(const wallOrder of normalized\)/);
  assert.match(source, /await persistCardOrder\(input\.supabase, wallOrder\.cards, wallOrder\.wallId, nowIso\)/);
  assert.doesNotMatch(source, /\.upsert\(/);
});
