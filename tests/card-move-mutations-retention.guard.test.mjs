import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Historical migration contract; the active successor inventory is checked separately.
const migrationPath = "supabase/history/migrations-pre-successor-20260929/20261219090000_card_move_mutations_retention.sql";
const migrationSql = readFileSync(migrationPath, "utf8");

test("archived migration: card_move_mutations retention migration includes created_at retention + 30 day purge", () => {
  assert.match(
    migrationSql,
    /alter\s+table\s+public\.card_move_mutations[\s\S]*alter\s+column\s+created_at\s+set\s+default\s+now\(\)/i,
  );
  assert.match(migrationSql, /create\s+index\s+if\s+not\s+exists\s+card_move_mutations_created_at_idx/i);
  assert.match(migrationSql, /created_at\s*<\s*now\(\)\s*-\s*interval\s+'30 days'/i);
});
