import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("student app class session route source guard", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/session/route.ts", "utf8");
  assert.match(source, /requireUserApi/);
  assert.match(source, /owner_id/);
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.match(source, /action\?: "start" \| "end" \| "autoStart" \| "startAutoPublish"/);
  assert.match(source, /STUDENT_APP_SUBMISSION_WINDOW_HOURS/);
  assert.match(source, /getStudentAppSubmissionExpiresAt/);
  assert.match(source, /isStudentAppSubmissionOpen/);
  assert.match(source, /status: "ended"/);
  assert.match(source, /toSnakeKeys\(\{[\s\S]*publishMode/);
  assert.match(source, /validateStudentAppAutoPublishWindow/);
  assert.doesNotMatch(source, /EDU_BUCKET|R2|publicUrl|r2Prefix|r2Key/);
});
