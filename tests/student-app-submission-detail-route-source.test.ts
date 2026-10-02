import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("detail route teacher-only and private", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/submissions/detail/route.ts", "utf8");
  assert.match(source, /requireUserApi/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /getEduBucketFromRuntimeEnv/);
  assert.match(source, /bucket\.get/);
  assert.doesNotMatch(source, /publicUrl|publish|r2Prefix|r2Key/);
});
