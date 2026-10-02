import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
// cards delete/restore currently writes deleted_at/deleted_by/updated_at/delete_reason only.
// deleted_purge_at exists for TTL purge migration, but is not part of cards delete/restore payload.
const requiredSoftDeleteColumns = ["deleted_at", "deleted_by", "updated_at", "delete_reason"];

const sqlFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
const cardsMigrationText = sqlFiles
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .filter((content) => content.toLowerCase().includes("cards"))
  .join("\n")
  .toLowerCase();

test("cards soft-delete payload columns exist in migrations text", () => {
  assert.notEqual(cardsMigrationText.length, 0, "expected at least one cards migration");

  for (const column of requiredSoftDeleteColumns) {
    assert.ok(
      cardsMigrationText.includes(column),
      `expected cards migrations to include soft-delete column token: ${column}`,
    );
  }
});
