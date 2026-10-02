import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260719134049_harden_card_files_rls.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").trim();

test("card_files migration enables RLS and limits client table privileges", () => {
  assert.match(normalized, /alter table public\.card_files enable row level security/);
  assert.match(normalized, /revoke all privileges on table public\.card_files from anon, authenticated/);
  assert.match(normalized, /grant select, insert, delete on table public\.card_files to authenticated/);
  assert.doesNotMatch(normalized, /grant[^;]*\bupdate\b[^;]*public\.card_files/i);
  assert.doesNotMatch(normalized, /grant[^;]*\btruncate\b[^;]*public\.card_files/i);
});

test("card_files policies require an editor role, matching board, and owned board file", () => {
  for (const name of [
    "Card files viewable by owning editors",
    "Card files insertable by owning editors",
    "Card files deletable by owning editors",
  ]) {
    assert.match(normalized, new RegExp(`drop policy if exists "${name}" on public\\.card_files`));
    assert.match(normalized, new RegExp(`create policy "${name}" on public\\.card_files`));
  }

  assert.equal((normalized.match(/bf\.board_id = w\.board_id/g) ?? []).length, 3);
  assert.equal((normalized.match(/bf\.owner_id = \(select auth\.uid\(\)\)/g) ?? []).length, 3);
  assert.equal((normalized.match(/public\.board_role\(w\.board_id\)\) in \('owner', 'editor'\)/g) ?? []).length, 3);
});

test("card_files migration neither mutates existing data nor creates privileged code", () => {
  assert.doesNotMatch(normalized, /\b(delete|update|insert into)\s+public\.card_files\b/i);
  assert.doesNotMatch(normalized, /security definer/i);
});
