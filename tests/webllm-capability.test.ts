import test from "node:test";
import assert from "node:assert/strict";

import { detectWebLLMCapability } from "@/lib/webllm/webllmCapability";

function withoutGlobalNavigator<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  try {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    return run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "navigator", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
  }
}

test("detectWebLLMCapability returns ready mode for secure chromium with webgpu and worker", () => {
  const result = detectWebLLMCapability({
    navigator: {
      userAgent: "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36",
      gpu: {},
      deviceMemory: 8,
    },
    isSecureContext: true,
    workerSupported: true,
  });

  assert.equal(result.recommendedMode, "local-webllm-ready");
  assert.equal(result.supported, true);
  assert.equal(result.fallbackReason, null);
  assert.equal(result.browserFamily, "chromium");
});

test("detectWebLLMCapability returns risky mode for non-chromium browser even with webgpu", () => {
  const result = detectWebLLMCapability({
    navigator: {
      userAgent: "Mozilla/5.0 Version/17.0 Safari/605.1.15",
      gpu: {},
      deviceMemory: 8,
    },
    isSecureContext: true,
    workerSupported: true,
  });

  assert.equal(result.recommendedMode, "local-webllm-risky");
  assert.equal(result.browserRiskLevel, "high");
});

test("detectWebLLMCapability returns fallback-only for missing webgpu", () => {
  const result = detectWebLLMCapability({
    navigator: {
      userAgent: "Mozilla/5.0 Firefox/125.0",
      deviceMemory: 16,
    },
    isSecureContext: true,
    workerSupported: true,
  });

  assert.equal(result.recommendedMode, "fallback-only");
  assert.equal(result.fallbackReason, "webgpu-unsupported");
  assert.equal(result.browserFamily, "firefox");
});

test("detectWebLLMCapability returns unknown when browser APIs are unavailable", () => {
  const result = withoutGlobalNavigator(() =>
    detectWebLLMCapability({
      isSecureContext: false,
      workerSupported: false,
    }),
  );

  assert.equal(result.recommendedMode, "unknown");
  assert.equal(result.fallbackReason, "not-browser");
  assert.equal(result.supported, false);
});
