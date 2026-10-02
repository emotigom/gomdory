import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/api/v1/student-apps/gallery/list/route.ts", "utf8");

test("gallery list route enforces student-safe published deployment policy", () => {
  assert.match(source, /export async function POST/);
  assert.doesNotMatch(source, /requireUserApi/);
  assert.match(source, /isLikelyShareCode/);
  assert.match(source, /getEduJoinSessionSafe/);
  assert.match(source, /\.from\("student_app_deployments"\)/);
  assert.match(source, /\.eq\("status", "published"\)/);
  assert.match(source, /\.not\("published_at", "is", null\)/);
  assert.match(source, /\.is\("deleted_at", null\)/);
  assert.match(source, /MAX_GALLERY_APPS\s*=\s*50/);
  assert.match(source, /displayUrl/);
  assert.match(source, /authorLabel: "친구 작품"/);
  assert.doesNotMatch(source, /student_app_submissions|submitted_by_name|student_note|teacher_note|contentText|contentBase64/);
  assert.doesNotMatch(source, /r2Prefix|r2_prefix|r2Key|r2_key/);
});
