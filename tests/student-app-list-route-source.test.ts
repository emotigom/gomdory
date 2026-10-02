import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/api/v1/dashboard/student-apps/list/route.ts", "utf8");

test("list route has required wiring and guards", () => {
  assert.equal(source.length > 0, true);
  assert.match(source, /requireUserApi/);
  assert.match(source, /boardId/);
  assert.match(source, /listStudentAppDeployments/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.doesNotMatch(source, /EDU_BUCKET|bucket|R2|public URL|publish|approve|router\.refresh|jszip|fflate|adm-zip|yauzl/i);
});
