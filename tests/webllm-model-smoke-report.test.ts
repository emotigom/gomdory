import test from "node:test";
import assert from "node:assert/strict";
import { createWebLLMDiagnosticReport } from "@/lib/webllm/webllmDiagnostics";

test("smoke report excludes prompt/response and identifiers", () => {
  const report = createWebLLMDiagnosticReport({
    supported: true, secureContext: true, webgpu: true, worker: true, browserFamily: "chromium", browserRiskLevel: "low", deviceMemoryGb: 8, deviceMemoryBucket: "8gb-plus", warnings: [], fallbackReason: null, recommendedMode: "local-webllm-ready",
  }, "2026-01-01T00:00:00.000Z", {
    smokeStatus: "complete", selectedModelId: "x", packageLoadMs: 1, modelLoadMs: 1, firstTokenLatencyMs: 1, totalRunMs: 3, generatedTokenEstimate: 2, tokensPerSecond: 1, errorCode: null, errorMessageCategory: null,
  });
  const json = JSON.stringify(report);
  for (const key of ["prompt", "response", "userId", "email", "boardId", "cardId", "studentName"]) assert.equal(json.includes(key), false);
});
