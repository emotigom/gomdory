import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const baselinePath = "supabase/migrations/20260929093150_successor_baseline.sql";
const baselineSql = readFileSync(baselinePath, "utf8");

test("successor baseline: site_content_revisions enables forced RLS and service_role-only policy", () => {
  assert.match(baselineSql, /alter table public\.site_content_revisions enable row level security;/i);
  assert.match(baselineSql, /alter table public\.site_content_revisions force row level security;/i);
  assert.match(
    baselineSql,
    /create policy site_content_revisions__service_role_all on public\.site_content_revisions/i,
  );
  assert.match(baselineSql, /to service_role/i);
  assert.match(baselineSql, /using \(true\)/i);
  assert.match(baselineSql, /with check \(true\)/i);
});
