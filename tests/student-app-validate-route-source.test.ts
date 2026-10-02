import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("route file exists and imports dry-run helper", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/validate/route.ts", "utf8");
  assert.match(source, /runStudentStaticAppDryRun/);
  assert.match(source, /requireUserApi/);
});

test("route avoids storage and db writes", () => {
  const source = readFileSync("app/api/v1/dashboard/student-apps/validate/route.ts", "utf8");
  assert.doesNotMatch(source, /\bR2\b|bucket|upload/i);
  assert.doesNotMatch(source, /supabase|migration|student_app_deployments/i);
  assert.doesNotMatch(source, /\binsert\b|\bupdate\b|\bupsert\b|\bdelete\b/i);
  assert.doesNotMatch(source, /public url|publish/i);
});

test("runtime student-app files avoid node crypto/buffer and zip deps", () => {
  const files = [
    "lib/student-apps/staticAppValidator.ts",
    "lib/student-apps/staticAppIntake.ts",
    "lib/student-apps/staticAppDryRun.ts",
    "app/api/v1/dashboard/student-apps/validate/route.ts",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /node:crypto|node:buffer|jszip|fflate|adm-zip|yauzl/);
  }
});
