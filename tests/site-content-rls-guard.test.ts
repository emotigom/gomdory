import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Historical migration contract; the active successor inventory is checked separately.
const migrationPath = "supabase/history/migrations-pre-successor-20260929/20260218120000_create_site_content_ops_cms_v1.sql";
const migrationSql = readFileSync(migrationPath, "utf8");

test("archived migration: site_content enables RLS and restricts policy to service_role", () => {
  assert.match(migrationSql, /alter table public\.site_content enable row level security;/i);
  assert.match(migrationSql, /alter table public\.site_content force row level security;/i);
  assert.match(migrationSql, /create policy "site_content_service_role_all"/i);
  assert.match(migrationSql, /to service_role/i);
  assert.match(migrationSql, /using \(auth\.role\(\) = 'service_role'\)/i);
  assert.match(migrationSql, /with check \(auth\.role\(\) = 'service_role'\)/i);
});
