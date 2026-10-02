type WebllmDegradedSnapshot = {
  until: number | null;
  retryReady: boolean;
};

const DEGRADED_UNTIL_KEY = "gomdory.edu.webllm.degradedUntil";
const DEGRADED_RETRY_KEY = "gomdory.edu.webllm.degradedRetryOnce";

const readNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

export function readWebllmDegradedGate(): WebllmDegradedSnapshot {
  const storage = getStorage();
  if (!storage) return { until: null, retryReady: false };
  try {
    const until = readNumber(storage.getItem(DEGRADED_UNTIL_KEY));
    const retryReady = storage.getItem(DEGRADED_RETRY_KEY) === "1";
    return { until, retryReady };
  } catch {
    return { until: null, retryReady: false };
  }
}

export function markWebllmDegraded(durationMs: number): WebllmDegradedSnapshot {
  const storage = getStorage();
  const until = Date.now() + durationMs;
  if (storage) {
    try {
      storage.setItem(DEGRADED_UNTIL_KEY, `${until}`);
      storage.removeItem(DEGRADED_RETRY_KEY);
    } catch {
      // ignore storage failures
    }
  }
  return { until, retryReady: false };
}

export function allowWebllmRetryOnce() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(DEGRADED_RETRY_KEY, "1");
  } catch {
    // ignore storage failures
  }
}

export function consumeWebllmRetryOnce(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const retryReady = storage.getItem(DEGRADED_RETRY_KEY) === "1";
    if (retryReady) {
      storage.removeItem(DEGRADED_RETRY_KEY);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
