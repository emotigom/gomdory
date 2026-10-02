import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const baselinePath = path.join(
  process.cwd(),
  "supabase/migrations/20260929093150_successor_baseline.sql",
);
const baseline = fs.readFileSync(baselinePath, "utf8");
const normalized = baseline.replace(/\s+/g, " ").trim();

test("successor baseline enables card_files RLS and limits client table privileges", () => {
  assert.match(normalized, /alter table public\.card_files enable row level security;/i);
  assert.match(
    normalized,
    /revoke all privileges on table public\.card_files from public, anon, authenticated, service_role;/i,
  );
  assert.match(
    normalized,
    /grant DELETE, INSERT, SELECT on table public\.card_files to authenticated;/i,
  );
  assert.doesNotMatch(
    normalized,
    /grant[^;]*\bUPDATE\b[^;]*on table public\.card_files to authenticated/i,
  );
  assert.doesNotMatch(
    normalized,
    /grant[^;]*\bTRUNCATE\b[^;]*on table public\.card_files to authenticated/i,
  );
});

test("successor baseline card_files policies require editor role, matching board, and owned board file", () => {
  for (const name of [
    "Card files viewable by owning editors",
    "Card files insertable by owning editors",
    "Card files deletable by owning editors",
  ]) {
    assert.match(
      normalized,
      new RegExp(`drop policy if exists "${name}" on public\\.card_files`),
    );
    assert.match(
      normalized,
      new RegExp(`create policy "${name}" on public\\.card_files`),
    );
  }

  assert.equal((normalized.match(/bf\.board_id = w\.board_id/g) ?? []).length, 3);
  assert.equal((normalized.match(/bf\.owner_id = \( SELECT auth\.uid\(\) AS uid\)/g) ?? []).length, 3);
  assert.equal(
    (
      normalized.match(
        /board_role\(w\.board_id\) AS board_role\) = ANY \(ARRAY\['owner'::text, 'editor'::text\]\)/g,
      ) ?? []
    ).length,
    3,
  );
});
