import type { WebLLMCapabilitySnapshot, WebLLMFallbackReason, WebLLMRecommendedMode } from "@/lib/webllm/webllmDiagnostics";

type BrowserLikeNavigator = {
  userAgent?: string;
  gpu?: unknown;
  deviceMemory?: number;
};

type CapabilityInput = {
  navigator?: BrowserLikeNavigator;
  isSecureContext?: boolean;
  workerSupported?: boolean;
};

function inferBrowserFamily(userAgent: string | undefined): WebLLMCapabilitySnapshot["browserFamily"] {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "unknown";
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox/")) return "firefox";
  if (ua.includes("chrome/") || ua.includes("chromium/")) return "chromium";
  if (ua.includes("safari/")) return "safari";
  return "unknown";
}

function inferDeviceMemoryBucket(deviceMemoryGb: number | null): WebLLMCapabilitySnapshot["deviceMemoryBucket"] {
  if (deviceMemoryGb === null) return "unknown";
  if (deviceMemoryGb < 4) return "lt-4gb";
  if (deviceMemoryGb < 8) return "4-8gb";
  return "8gb-plus";
}

function inferBrowserRiskLevel(browserFamily: WebLLMCapabilitySnapshot["browserFamily"]): WebLLMCapabilitySnapshot["browserRiskLevel"] {
  if (browserFamily === "chromium" || browserFamily === "edge") return "low";
  if (browserFamily === "unknown") return "unknown";
  return "high";
}

export function detectWebLLMCapability(input: CapabilityInput = {}): WebLLMCapabilitySnapshot {
  const nav = input.navigator ?? (typeof navigator !== "undefined" ? (navigator as BrowserLikeNavigator) : undefined);
  const secureContext = input.isSecureContext ?? (typeof window !== "undefined" ? window.isSecureContext : false);
  const worker = input.workerSupported ?? (typeof Worker !== "undefined");
  const webgpu = Boolean(nav?.gpu);
  const deviceMemoryGb = typeof nav?.deviceMemory === "number" ? nav.deviceMemory : null;
  const browserFamily = inferBrowserFamily(nav?.userAgent);
  const browserRiskLevel = inferBrowserRiskLevel(browserFamily);
  const deviceMemoryBucket = inferDeviceMemoryBucket(deviceMemoryGb);
  const warnings: string[] = [];

  let fallbackReason: WebLLMFallbackReason | null = null;
  if (!nav) fallbackReason = "not-browser";
  else if (!secureContext) fallbackReason = "insecure-context";
  else if (!webgpu) fallbackReason = "webgpu-unsupported";
  else if (!worker) fallbackReason = "worker-unsupported";

  if (deviceMemoryBucket === "lt-4gb") {
    warnings.push("device-memory-low");
    if (!fallbackReason) fallbackReason = "insufficient-memory";
  }
  if (!secureContext) warnings.push("secure-context-required");
  if (!webgpu) warnings.push("webgpu-unavailable");
  if (!worker) warnings.push("worker-unavailable");
  if (browserFamily !== "chromium" && browserFamily !== "edge") warnings.push("browser-family-risk");

  let recommendedMode: WebLLMRecommendedMode;
  if (!nav) {
    recommendedMode = "unknown";
  } else if (!webgpu || !secureContext || !worker) {
    recommendedMode = "fallback-only";
  } else if (browserFamily !== "chromium" && browserFamily !== "edge") {
    recommendedMode = "local-webllm-risky";
  } else if (warnings.length > 0) {
    recommendedMode = "local-webllm-risky";
  } else {
    recommendedMode = "local-webllm-ready";
  }

  const supported = recommendedMode === "local-webllm-ready";

  return {
    supported,
    secureContext,
    webgpu,
    worker,
    browserFamily,
    browserRiskLevel,
    deviceMemoryGb,
    deviceMemoryBucket,
    warnings,
    fallbackReason,
    recommendedMode,
  };
}
