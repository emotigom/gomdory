import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
// board_files uses buildSoftDeletePayload + buildRestorePayload + fallback({ deleted_at })
// so we assert the union of those payload tokens is present in migrations.
const requiredSoftDeleteColumns = ["deleted_at", "deleted_by", "deleted_purge_at", "updated_at", "delete_reason"];

const sqlFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
const boardFilesMigrationText = sqlFiles
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .filter((content) => content.toLowerCase().includes("board_files"))
  .join("\n")
  .toLowerCase();

test("board_files soft-delete payload columns exist in migrations text", () => {
  assert.notEqual(boardFilesMigrationText.length, 0, "expected at least one board_files migration");

  for (const column of requiredSoftDeleteColumns) {
    assert.ok(
      boardFilesMigrationText.includes(column),
      `expected board_files migrations to include soft-delete column token: ${column}`,
    );
  }
});
