import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("teacher submissions list route source guard", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/submissions/list/route.ts", "utf8");
  assert.match(source, /requireUserApi/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /boardId/);
  assert.match(source, /student_note/);
  assert.match(source, /teacher_note/);
  assert.match(source, /reviewed_at/);
  assert.match(source, /archived_at/);
  assert.match(source, /studentNote:\s*typedRow\.studentNote/);
  assert.match(source, /teacherNote:\s*typedRow\.teacherNote/);
  assert.match(source, /reviewedAt:\s*typedRow\.reviewedAt/);
  assert.match(source, /archivedAt:\s*typedRow\.archivedAt/);
  assert.doesNotMatch(source, /EDU_BUCKET|R2Bucket|publish|publicUrl|contentText|contentBase64|r2Prefix|r2Key/);
});
