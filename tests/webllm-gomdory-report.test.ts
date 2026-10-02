import test from "node:test";
import assert from "node:assert/strict";
import { createWebLLMDiagnosticReport } from "@/lib/webllm/webllmDiagnostics";

test("copied report excludes prompt/response and identifiers with gomdory metrics", () => {
  const report = createWebLLMDiagnosticReport({ supported: true, secureContext: true, webgpu: true, worker: true, browserFamily: "chromium", browserRiskLevel: "low", deviceMemoryGb: 8, deviceMemoryBucket: "8gb-plus", warnings: [], fallbackReason: null, recommendedMode: "local-webllm-ready" }, undefined, {
    smokeStatus: "complete", selectedModelId: "x", packageLoadMs: 1, modelLoadMs: 1, firstTokenLatencyMs: 1, totalRunMs: 2, generatedTokenEstimate: 2, tokensPerSecond: 1, errorCode: null, errorMessageCategory: null,
    modelSource: "gomdory-r2", manifestUrl: "https://models.gomdory.com/libs/manifest.v1.json", manifestLoadMs: 12, manifestModelCount: 3, modelOrigin: "https://models.gomdory.com", gomdoryFallbackReason: null,
  });
  const json = JSON.stringify(report);
  for (const key of ["prompt", "response", "messages", "userId", "email", "studentName", "boardId", "cardId", "lessonAnswer"]) assert.equal(json.includes(key), false);
});
