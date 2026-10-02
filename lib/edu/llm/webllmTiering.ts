export type WebLLMDeviceTier = "lite" | "normal" | "fast";

export type WebLLMDeviceCaps = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  wasmThreadsSupported: boolean;
};

export type WebLLMTierDecision = {
  tier: WebLLMDeviceTier;
  selectedTier: WebLLMDeviceTier;
  preferFallback: boolean;
  reason: string;
  tierReason: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  deviceCaps: WebLLMDeviceCaps;
  cooldownActive: boolean;
};

const COOLDOWN_KEY = "edu.webllm.autoTier.cooldownUntil";
const FAILURE_COUNT_KEY = "edu.webllm.autoTier.failureCount";
const FAILURE_TS_KEY = "edu.webllm.autoTier.lastFailureAt";
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000;
const FAILURE_THRESHOLD = 2;

const wasmThreadProbeBytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d,
  0x01, 0x00, 0x00, 0x00,
  0x05, 0x04, 0x01, 0x03, 0x01, 0x01,
]);

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const detectWasmThreadsSupported = (sharedArrayBuffer: boolean) => {
  if (typeof WebAssembly === "undefined" || !sharedArrayBuffer) {
    return false;
  }
  try {
    return WebAssembly.validate(wasmThreadProbeBytes);
  } catch {
    return false;
  }
};

export function readWebLLMCooldownState(now = Date.now()): { cooldownActive: boolean; cooldownUntil: number | null } {
  const storage = getStorage();
  if (!storage) return { cooldownActive: false, cooldownUntil: null };
  try {
    const cooldownUntil = readNumber(storage.getItem(COOLDOWN_KEY));
    return {
      cooldownActive: typeof cooldownUntil === "number" && cooldownUntil > now,
      cooldownUntil,
    };
  } catch {
    return { cooldownActive: false, cooldownUntil: null };
  }
}

export function recordWebLLMInitFailure(now = Date.now()) {
  const storage = getStorage();
  if (!storage) return { cooldownActive: false, cooldownUntil: null, failureCount: 0 };
  try {
    const lastFailureAt = readNumber(storage.getItem(FAILURE_TS_KEY));
    const previousCount = readNumber(storage.getItem(FAILURE_COUNT_KEY)) ?? 0;
    const withinWindow = typeof lastFailureAt === "number" && now - lastFailureAt <= FAILURE_WINDOW_MS;
    const failureCount = withinWindow ? previousCount + 1 : 1;
    storage.setItem(FAILURE_COUNT_KEY, String(failureCount));
    storage.setItem(FAILURE_TS_KEY, String(now));

    if (failureCount >= FAILURE_THRESHOLD) {
      const cooldownUntil = now + COOLDOWN_MS;
      storage.setItem(COOLDOWN_KEY, String(cooldownUntil));
      return { cooldownActive: true, cooldownUntil, failureCount };
    }
    return { cooldownActive: false, cooldownUntil: null, failureCount };
  } catch {
    return { cooldownActive: false, cooldownUntil: null, failureCount: 0 };
  }
}

export function clearWebLLMFailureTracking() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(FAILURE_COUNT_KEY);
    storage.removeItem(FAILURE_TS_KEY);
    storage.removeItem(COOLDOWN_KEY);
  } catch {
    // ignore storage failures
  }
}

export function getWebLLMDeviceTier(input?: {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  crossOriginIsolated?: boolean;
  sharedArrayBuffer?: boolean;
  wasmThreadsSupported?: boolean;
  cooldownActive?: boolean;
}): WebLLMTierDecision {
  const deviceMemory = input?.deviceMemory;
  const hardwareConcurrency = input?.hardwareConcurrency;
  const crossOriginIsolated = input?.crossOriginIsolated === true;
  const sharedArrayBuffer = input?.sharedArrayBuffer ?? typeof SharedArrayBuffer !== "undefined";
  const wasmThreadsSupported = input?.wasmThreadsSupported ?? detectWasmThreadsSupported(sharedArrayBuffer);
  const cooldownActive = input?.cooldownActive ?? readWebLLMCooldownState().cooldownActive;

  const lowMemory = typeof deviceMemory === "number" && deviceMemory > 0 && deviceMemory < 8;
  const lowCpu =
    typeof hardwareConcurrency === "number" && hardwareConcurrency > 0 && hardwareConcurrency < 8;

  const deviceCaps: WebLLMDeviceCaps = {
    deviceMemory,
    hardwareConcurrency,
    crossOriginIsolated,
    sharedArrayBuffer,
    wasmThreadsSupported,
  };

  if (cooldownActive) {
    return {
      tier: "lite",
      selectedTier: "lite",
      preferFallback: true,
      reason: "cooldown_active",
      tierReason: "cooldown_active",
      deviceMemory,
      hardwareConcurrency,
      deviceCaps,
      cooldownActive,
    };
  }

  if (lowMemory || lowCpu) {
    return {
      tier: "lite",
      selectedTier: "lite",
      preferFallback: true,
      reason: lowMemory ? "device_memory_lt_8" : "hardware_concurrency_lt_8",
      tierReason: lowMemory ? "device_memory_lt_8" : "hardware_concurrency_lt_8",
      deviceMemory,
      hardwareConcurrency,
      deviceCaps,
      cooldownActive,
    };
  }

  if (crossOriginIsolated && wasmThreadsSupported) {
    return {
      tier: "fast",
      selectedTier: "fast",
      preferFallback: false,
      reason: "cross_origin_isolated_with_threads",
      tierReason: "cross_origin_isolated_with_threads",
      deviceMemory,
      hardwareConcurrency,
      deviceCaps,
      cooldownActive,
    };
  }

  return {
    tier: "normal",
    selectedTier: "normal",
    preferFallback: false,
    reason: "default",
    tierReason: "default",
    deviceMemory,
    hardwareConcurrency,
    deviceCaps,
    cooldownActive,
  };
}
