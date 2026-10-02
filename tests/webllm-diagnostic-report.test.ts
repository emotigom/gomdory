import test from "node:test";
import assert from "node:assert/strict";

import { createWebLLMDiagnosticReport, type WebLLMCapabilitySnapshot } from "@/lib/webllm/webllmDiagnostics";

test("createWebLLMDiagnosticReport is deterministic from snapshot + timestamp", () => {
  const snapshot: WebLLMCapabilitySnapshot = {
    supported: false,
    secureContext: true,
    webgpu: true,
    worker: true,
    browserFamily: "chromium",
    browserRiskLevel: "low",
    deviceMemoryGb: 8,
    deviceMemoryBucket: "8gb-plus",
    warnings: ["device-memory-low"],
    fallbackReason: "insufficient-memory",
    recommendedMode: "local-webllm-risky",
  };

  const report = createWebLLMDiagnosticReport(snapshot, "2026-01-02T03:04:05.000Z");
  assert.deepEqual(report, {
    timestamp: "2026-01-02T03:04:05.000Z",
    webgpuSupported: true,
    secureContext: true,
    workerSupported: true,
    browserFamily: "chromium",
    browserRiskLevel: "low",
    deviceMemoryBucket: "8gb-plus",
    recommendedMode: "local-webllm-risky",
    fallbackReason: "insufficient-memory",
    warnings: ["device-memory-low"],
  });
});

test("report excludes forbidden keys", () => {
  const snapshot: WebLLMCapabilitySnapshot = {
    supported: true,
    secureContext: true,
    webgpu: true,
    worker: true,
    browserFamily: "edge",
    browserRiskLevel: "low",
    deviceMemoryGb: 16,
    deviceMemoryBucket: "8gb-plus",
    warnings: [],
    fallbackReason: null,
    recommendedMode: "local-webllm-ready",
  };

  const json = JSON.stringify(createWebLLMDiagnosticReport(snapshot, "2026-01-01T00:00:00.000Z"));
  for (const forbiddenKey of ["prompt", "response", "userId", "email", "boardId", "cardId", "studentName"]) {
    assert.equal(json.includes(forbiddenKey), false);
  }
});
