import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { summarizePublishLimiterPolicy } from "@/lib/edu/publish/quota";

const runtimeSummaryPath = path.join(process.cwd(), "lib/system/diag/runtimeSummary.ts");
const runtimeSummarySource = fs.readFileSync(runtimeSummaryPath, "utf8");
const routePath = path.join(process.cwd(), "app/api/v1/system/diag/route.ts");
const routeSource = fs.readFileSync(routePath, "utf8");

test("publish limiter policy summary is success-based", () => {
  const policy = summarizePublishLimiterPolicy();
  assert.equal(policy.mode, "success-based");
  assert.deepEqual(policy.countsOnly, ["PUBLISHED"]);
  assert.equal(policy.dailyLimit, 7);
});

test("runtime summary owns system diag edu publish diagnostics fields", () => {
  assert.match(runtimeSummarySource, /eduPublish:\s*\{/m);
  assert.match(runtimeSummarySource, /r2Target:\s*getEduPublishR2TargetMeta\(\)/m);
  assert.match(runtimeSummarySource, /policySummary:\s*"success-based: count only PUBLISHED commits per KST day"/m);
});

test("runtime summary owns decorate-specific readiness checks while the route delegates to it", () => {
  assert.match(runtimeSummarySource, /checkDecorateReadiness/);
  assert.match(runtimeSummarySource, /hasOpenAiKey/);
  assert.match(runtimeSummarySource, /hasRateLimitTableAccess/);
  assert.match(runtimeSummarySource, /hasDecoratePlanCacheAccess/);
  assert.match(runtimeSummarySource, /hasJoinSessionAccess/);
  assert.match(runtimeSummarySource, /decorateReadiness/);

  assert.match(routeSource, /buildSystemDiagResponse/);
  assert.doesNotMatch(routeSource, /checkDecorateReadiness/);
});
