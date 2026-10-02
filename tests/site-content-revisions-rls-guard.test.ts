import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Historical migration contract; the active successor inventory is checked separately.
const migrationPath = "supabase/history/migrations-pre-successor-20260929/20260218137000_site_content_revisions_v1.sql";
const migrationSql = readFileSync(migrationPath, "utf8");

test("archived migration: site_content_revisions enables RLS and service_role-only policy", () => {
  assert.match(migrationSql, /alter table public\.site_content_revisions enable row level security;/i);
  assert.match(migrationSql, /alter table public\.site_content_revisions force row level security;/i);
  assert.match(migrationSql, /create policy "site_content_revisions__service_role_all"/i);
  assert.match(migrationSql, /to service_role/i);
  assert.match(migrationSql, /using \(true\)/i);
  assert.match(migrationSql, /with check \(true\)/i);
});
