export type NetworkPrepStage = "idle" | "preparing" | "waiting" | "fallback";

export type NetworkPrepStatus = {
  stage: NetworkPrepStage;
  reason: string | null;
  updatedAt: number;
  until: number | null;
};

let status: NetworkPrepStatus = {
  stage: "idle",
  reason: null,
  updatedAt: Date.now(),
  until: null,
};

const listeners = new Set<(next: NetworkPrepStatus) => void>();
let clearTimer: number | null = null;

const notify = () => {
  const snapshot = getNetworkPrepStatus();
  listeners.forEach((listener) => listener(snapshot));
};

const scheduleClear = () => {
  if (clearTimer) {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (!status.until) return;
  const delay = Math.max(0, status.until - Date.now());
  clearTimer = window.setTimeout(() => {
    if (status.until && Date.now() >= status.until) {
      status = {
        stage: "idle",
        reason: null,
        updatedAt: Date.now(),
        until: null,
      };
      notify();
    }
  }, delay);
};

export const setNetworkPrepStatus = (
  stage: NetworkPrepStage,
  options?: { reason?: string | null; ttlMs?: number; until?: number | null },
) => {
  const until =
    options?.until !== undefined
      ? options.until
      : options?.ttlMs
        ? Date.now() + options.ttlMs
        : null;
  status = {
    stage,
    reason: options?.reason ?? null,
    updatedAt: Date.now(),
    until,
  };
  if (typeof window !== "undefined") {
    scheduleClear();
  }
  notify();
};

export const clearNetworkPrepStatus = () => setNetworkPrepStatus("idle");

export const getNetworkPrepStatus = (): NetworkPrepStatus => {
  if (status.until && Date.now() >= status.until) {
    status = {
      stage: "idle",
      reason: null,
      updatedAt: Date.now(),
      until: null,
    };
  }
  return { ...status };
};

export const subscribeNetworkPrepStatus = (listener: (next: NetworkPrepStatus) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
