import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync("app/api/v1/edu/ai/chat/route.ts", "utf8");
const admissionSource = readFileSync("lib/server/eduAiChatAdmission.ts", "utf8");

test("edu AI chat fails closed when the rate-limit backend is unavailable", () => {
  assert.match(routeSource, /evaluateEduAiChatAdmission\(/);
  assert.match(admissionSource, /status: 503/);
  assert.match(admissionSource, /code: "EDU_AI_RATE_LIMIT_UNAVAILABLE"/);
  assert.match(admissionSource, /stage: "rate_limit_backend"/);
  assert.match(admissionSource, /component: "rate_limit"/);
  assert.match(admissionSource, /requestId/);
  assert.match(admissionSource, /\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(admissionSource, /String\(error\)|error\.message|stack|credential|sentinel/i);

  const providerBoundaryIndex = routeSource.indexOf("runEduRouteAdapter({");
  const providerServiceIndex = routeSource.indexOf("runEduAiStudentChatRouteService({");
  const rateLimitCatchReturnIndex = routeSource.indexOf("evaluateEduAiChatAdmission(");
  assert.ok(rateLimitCatchReturnIndex < providerBoundaryIndex);
  assert.ok(rateLimitCatchReturnIndex < providerServiceIndex);
  assert.match(admissionSource, /status: 429[\s\S]*?code: "EDU_AI_RATE_LIMITED"/);
  assert.match(admissionSource, /Retry-After/);
  assert.doesNotMatch(routeSource, /CLASS_ASSISTANT_SYSTEM_PROMPT|buildSafeModeAnswer|buildEduStudentRateLimitKey|checkRateLimit/);
});
