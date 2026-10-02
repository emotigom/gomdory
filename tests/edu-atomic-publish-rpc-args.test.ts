import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function read(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test("publish callers use v2 RPC with in_slug payload", () => {
  const commitRoute = read("lib/server/edu/publish/handleEduPublishCommit.ts");
  assert.match(commitRoute, /rpc\(EDU_ATOMIC_PUBLISH_RPC_V2,\s*publishPayload\)/m);
  assert.match(commitRoute, /const inSlug = resolveInSlug\(publishPayload\);[\s\S]*INVALID_SLUG/m);

  const retryRoute = read("lib/server/edu/publish/handlePublishRetryRoute.ts");
  assert.match(retryRoute, /const publishPayload\s*=\s*buildAtomicPublishPayload\([\s\S]*\binSlug\s*:\s*project\.slug,/m);
  assert.match(retryRoute, /rpc\(EDU_ATOMIC_PUBLISH_RPC_V2,\s*publishPayload\)/m);
  assert.match(retryRoute, /resolveInSlug\(publishPayload\)\)[\s\S]*INVALID_SLUG/m);

  const teacherRetryRoute = read("lib/server/edu/teacher/handleTeacherPublishRetryRoute.ts");
  assert.match(
    teacherRetryRoute,
    /const publishPayload\s*=\s*buildAtomicPublishPayload\([\s\S]*\binSlug\s*:\s*project\.slug,/m,
  );
  assert.match(teacherRetryRoute, /rpc\(EDU_ATOMIC_PUBLISH_RPC_V2,\s*publishPayload\)/m);
  assert.match(teacherRetryRoute, /resolveInSlug\(publishPayload\)\)[\s\S]*INVALID_SLUG/m);
});

test("migration defines v2 signature and legacy slug wrapper", () => {
  const migrationPath = "supabase/migrations/20261216090000_add_edu_atomic_publish_v2_wrapper.sql";
  const sql = read(migrationPath);

  assert.match(sql, /CREATE FUNCTION public\.edu_atomic_publish_v2\([\s\S]*\bin_slug text/i);
  assert.match(sql, /CREATE FUNCTION public\.edu_atomic_publish\([\s\S]*\bslug text/i);
  assert.match(sql, /DEPRECATED: legacy compatibility wrapper/i);
  assert.match(sql, /RETURN public\.edu_atomic_publish_v2\([\s\S]*\bslug,/i);
});
