import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("review route is teacher-only and metadata-only", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/submissions/review/route.ts", "utf8");
  assert.match(source, /export async function POST/);
  assert.match(source, /requireUserApi/);
  assert.match(source, /owner_id/);
  assert.match(source, /needs_fix/);
  assert.match(source, /accepted/);
  assert.match(source, /archived/);
  assert.match(source, /reopen/);
  assert.match(source, /teacher_note/);
  assert.match(source, /reviewed_at/);
  assert.match(source, /archived_at/);
  assert.match(source, /select\("id, is_latest"\)/);
  assert.match(source, /latest_submission_required/);
  assert.match(source, /status: "accepted", teacherNote, reviewedAt: now, archivedAt: null/);
  assert.match(source, /toSnakeKeys\(patch\)/);
  assert.doesNotMatch(source, /EDU_BUCKET|R2Bucket|bucket\.get|publicUrl|publish|r2Prefix|r2Key/);
});
