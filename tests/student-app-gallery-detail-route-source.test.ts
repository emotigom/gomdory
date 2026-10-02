import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/api/v1/student-apps/gallery/detail/route.ts", "utf8");

test("gallery detail route no longer returns private submission files", () => {
  assert.match(source, /export async function POST/);
  assert.doesNotMatch(source, /requireUserApi/);
  assert.match(source, /410/);
  assert.match(source, /public_viewer_required/);
  assert.match(source, /공개 보기 링크/);
  assert.doesNotMatch(source, /getEduBucketFromRuntimeEnv|bucket\.get|arrayBuffer|TextDecoder|btoa/);
  assert.doesNotMatch(source, /student_app_submissions|student_app_submission_files|contentText|contentBase64/);
  assert.doesNotMatch(source, /submitted_by_name|student_note|teacher_note|r2_key|r2_prefix/);
});
