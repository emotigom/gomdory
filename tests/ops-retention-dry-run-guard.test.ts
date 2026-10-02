import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Historical migration contract; the active successor inventory is checked separately.
const migrationPath = "supabase/history/migrations-pre-successor-20260929/20260218133000_ops_retention_dry_run_guardrails.sql";

const migrationSql = readFileSync(migrationPath, "utf8");

test("archived migration: run_ops_data_retention dry-run guards destructive deletes", () => {
  assert.match(migrationSql, /if not p_dry_run then/i);

  const guardBlockMatch = migrationSql.match(/if not p_dry_run then([\s\S]*?)end if;/i);
  assert.ok(guardBlockMatch, "expected guarded mutation block");

  const guardedBlock = guardBlockMatch?.[1] ?? "";
  assert.match(guardedBlock, /delete from public\.community_reports/i);
  assert.match(guardedBlock, /delete from public\.audit_logs/i);
  assert.match(guardedBlock, /delete from public\.rate_limits/i);
  assert.match(guardedBlock, /delete from public\.api_rate_limits/i);
  assert.match(guardedBlock, /delete from public\.rate_limit_counters/i);
});
