import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { POST } from "@/app/api/v1/lesson-run/start/route";

const routeSource = readFileSync("app/api/v1/lesson-run/start/route.ts", "utf8");
const helperSource = readFileSync("lib/lesson-run/startLessonRun.ts", "utf8");

function request(body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("http://localhost/api/v1/lesson-run/start", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("start lesson run API is POST-only and delegates normalized body to the facade", () => {
  assert.match(routeSource, /export async function POST/);
  assert.doesNotMatch(routeSource, /export async function GET/);
  assert.match(routeSource, /export async function POST\(request: Request\)\s*\{\s*return handlePost\(request\);\s*\}/);
  assert.match(routeSource, /content-type/);
  assert.match(routeSource, /application\/json/);
  assert.match(routeSource, /startLessonRunFn/);
  assert.match(routeSource, /requireUserApiFn/);
  assert.match(routeSource, /const startLessonRunFn = deps\.startLessonRunFn \?\? startLessonRun/);
  assert.match(routeSource, /await startLessonRunFn\(\s*\{\s*boardId,\s*requestedPreset:.*durationMinutes:.*options:.*idempotencyKey:.*clientRequestId:.*\},/s);
  assert.doesNotMatch(routeSource, /\.insert\(/);
});

test("start lesson run API rejects non JSON and missing board id before the facade", async () => {
  const nonJson = await POST(request({ boardId: "board-1" }, { "content-type": "text/plain" }));
  const missing = await POST(request({}));

  assert.equal(nonJson.status, 415);
  assert.equal(missing.status, 400);
  assert.deepEqual(await nonJson.json(), {
    ok: false,
    error: { code: "json_required", message: "JSON 요청만 지원합니다." },
  });
  assert.deepEqual(await missing.json(), {
    ok: false,
    error: { code: "board_id_required", message: "boardId가 필요합니다." },
  });

  const facadeCall = routeSource.indexOf("await startLessonRunFn(");
  assert.ok(routeSource.indexOf("if (!isJsonRequest(request))") < facadeCall);
  assert.ok(routeSource.indexOf("if (!boardId)") < facadeCall);
});

test("feature flag is server-only and defaults off", () => {
  assert.match(helperSource, /import "server-only"/);
  assert.match(helperSource, /LESSON_RUN_START_FACADE_ENABLED/);
  assert.match(helperSource, /=== "true"/);
  assert.doesNotMatch(helperSource + routeSource, /NEXT_PUBLIC_/);
});

test("route and helper do not expose raw Supabase/service-role errors", () => {
  assert.doesNotMatch(routeSource, /console\.error|error\.message|Supabase|service_role/);
  assert.doesNotMatch(helperSource, /service_role|error\.message|JSON\.stringify\(.*error/);
  assert.match(helperSource, /internal_error/);
});
