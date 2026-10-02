export type WebLLMFallbackReason =
  | "lab-disabled"
  | "not-browser"
  | "insecure-context"
  | "webgpu-unsupported"
  | "worker-unsupported"
  | "insufficient-memory"
  | "unknown";

export type WebLLMRecommendedMode = "local-webllm-ready" | "local-webllm-risky" | "fallback-only" | "unknown";

export type WebLLMCapabilitySnapshot = {
  supported: boolean;
  secureContext: boolean;
  webgpu: boolean;
  worker: boolean;
  browserFamily: "chromium" | "safari" | "firefox" | "edge" | "unknown";
  browserRiskLevel: "low" | "medium" | "high" | "unknown";
  deviceMemoryGb: number | null;
  deviceMemoryBucket: "unknown" | "lt-4gb" | "4-8gb" | "8gb-plus";
  warnings: string[];
  fallbackReason: WebLLMFallbackReason | null;
  recommendedMode: WebLLMRecommendedMode;
};

import type { WebLLMModelSmokeResult } from "./webllmModelSmokeTypes";

export type WebLLMDiagnosticReport = {
  timestamp: string;
  webgpuSupported: boolean;
  secureContext: boolean;
  workerSupported: boolean;
  browserFamily: WebLLMCapabilitySnapshot["browserFamily"];
  browserRiskLevel: WebLLMCapabilitySnapshot["browserRiskLevel"];
  deviceMemoryBucket: WebLLMCapabilitySnapshot["deviceMemoryBucket"];
  recommendedMode: WebLLMRecommendedMode;
  fallbackReason: WebLLMFallbackReason | null;
  warnings: string[];
  modelSmokeResult?: WebLLMModelSmokeResult;
};

export function createWebLLMDiagnosticReport(
  snapshot: WebLLMCapabilitySnapshot,
  timestamp = new Date().toISOString(),
  modelSmokeResult?: WebLLMModelSmokeResult,
): WebLLMDiagnosticReport {
  return {
    timestamp,
    webgpuSupported: snapshot.webgpu,
    secureContext: snapshot.secureContext,
    workerSupported: snapshot.worker,
    browserFamily: snapshot.browserFamily,
    browserRiskLevel: snapshot.browserRiskLevel,
    deviceMemoryBucket: snapshot.deviceMemoryBucket,
    recommendedMode: snapshot.recommendedMode,
    fallbackReason: snapshot.fallbackReason,
    warnings: [...snapshot.warnings],
    ...(modelSmokeResult ? { modelSmokeResult } : {}),
  };
}
