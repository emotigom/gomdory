import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("store route source guards", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/store/route.ts", "utf8");
  assert.match(source, /requireUserApi/);
  assert.match(source, /getEduBucketFromRuntimeEnv/);
  assert.doesNotMatch(source, /globalThis as \{ EDU_BUCKET\?: R2Bucket \}/);
  assert.match(source, /storage_unavailable/);
  assert.match(source, /storeStudentAppDeployment/);
  assert.doesNotMatch(source, /public url|publish|approve|router\.refresh|jszip|fflate|adm-zip|yauzl/i);
});

test("deployment store source guards", () => {
  const source = readFileSync("lib/student-apps/storeStudentAppDeployment.ts", "utf8");
  assert.doesNotMatch(source, /from\("student_app_deployment_files"\)[\s\S]*?\.single\(\)/);
  assert.match(source, /deleteStudentAppStoredObjectsFromR2/);
  assert.doesNotMatch(source, /publicUrl|publish/);
});
