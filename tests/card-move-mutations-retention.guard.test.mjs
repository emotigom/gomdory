import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const baselinePath = "supabase/migrations/20260929093150_successor_baseline.sql";
const baselineSql = readFileSync(baselinePath, "utf8");

test("successor baseline: card_move_mutations keeps created_at default and retention index", () => {
  assert.match(
    baselineSql,
    /create\s+table\s+public\.card_move_mutations[\s\S]*?created_at\s+timestamp\s+with\s+time\s+zone\s+default\s+now\(\)\s+not\s+null/i,
  );
  assert.match(baselineSql, /create\s+index\s+card_move_mutations_created_at_idx\s+on\s+public\.card_move_mutations/i);
});
