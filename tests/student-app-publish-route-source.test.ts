import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("publish route source guards", () => {
  const path = "app/api/v1/dashboard/student-apps/publish/route.ts";
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, "utf8");
  assert.match(source, /requireUserApi/);
  assert.match(source, /publishStudentAppDeployment/);
  assert.match(source, /unpublishStudentAppDeployment/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.doesNotMatch(source, /EDU_BUCKET|R2|bucket\.get|zip|jszip|fflate|yauzl|router\.refresh|resolvePublishedStudentAppAsset/i);
});
