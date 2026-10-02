import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const baselinePath = "supabase/migrations/20260929093150_successor_baseline.sql";
const baselineSql = readFileSync(baselinePath, "utf8");

test("successor baseline: site_content enables forced RLS and restricts policy to service_role", () => {
  assert.match(baselineSql, /alter table public\.site_content enable row level security;/i);
  assert.match(baselineSql, /alter table public\.site_content force row level security;/i);
  assert.match(baselineSql, /create policy site_content_service_role_all on public\.site_content/i);
  assert.match(baselineSql, /to service_role/i);
  assert.match(baselineSql, /using \(\(auth\.role\(\) = 'service_role'::text\)\)/i);
  assert.match(baselineSql, /with check \(\(auth\.role\(\) = 'service_role'::text\)\)/i);
});
