import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
// boards soft-delete flow writes deleted_at; deleted_purge_at is used by TTL purge migration.
// boards schema does not define deleted_by/delete_reason, so those tokens are intentionally excluded.
const requiredSoftDeleteColumns = ["deleted_at", "deleted_purge_at"];

const sqlFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
const boardsMigrationText = sqlFiles
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .filter((content) => content.toLowerCase().includes("boards"))
  .join("\n")
  .toLowerCase();

test("boards soft-delete payload columns exist in migrations text", () => {
  assert.notEqual(boardsMigrationText.length, 0, "expected at least one boards migration");

  for (const column of requiredSoftDeleteColumns) {
    assert.ok(
      boardsMigrationText.includes(column),
      `expected boards migrations to include soft-delete column token: ${column}`,
    );
  }
});
