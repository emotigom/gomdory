import { getRampupMaxWaitMs, getRampupWaitMs, getRampupWindowMs } from "./config";
import {
  recordRampupEnter,
  recordRampupMaxWaitHit,
  setRampupWaitActiveUntil,
} from "./metrics";

type RampupEnterResponse = {
  ok: boolean;
  slot: "origin" | "wait";
  waitMs: number;
  issuedAt: number;
  token?: string | null;
  windowRemainingMs?: number | null;
};

type RampupGate = {
  slot: "origin" | "wait";
  waitMs: number;
  token: string | null;
  issuedAt: number;
  windowRemainingMs: number | null;
  leave: () => Promise<void>;
};

const peerIds = new Map<string, string>();
const waitAppliedUrls = new Map<string, Set<string>>();
const sessionStartAt = new Map<string, number>();

const getPeerId = (code: string) => {
  const existing = peerIds.get(code);
  if (existing) return existing;
  const peerId = crypto.randomUUID();
  peerIds.set(code, peerId);
  return peerId;
};

const getSessionStartAt = (code: string) => {
  const existing = sessionStartAt.get(code);
  if (existing) return existing;
  const startedAt = Date.now();
  sessionStartAt.set(code, startedAt);
  return startedAt;
};

const getWaitSet = (code: string) => {
  const existing = waitAppliedUrls.get(code);
  if (existing) return existing;
  const set = new Set<string>();
  waitAppliedUrls.set(code, set);
  return set;
};

const withTimeout = async <T>(task: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return (await Promise.race([task, timeoutPromise])) as T;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

const postRampup = async (
  endpoint: "enter" | "leave",
  payload: Record<string, string>,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const response = await withTimeout(
    fetch(`/__edu_p2p/rampup/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }),
    timeoutMs,
  );
  window.clearTimeout(timeoutId);
  if (!response.ok) return null;
  return (await response.json()) as RampupEnterResponse;
};

const scheduleWaitIndicatorClear = (until: number) => {
  const delay = Math.max(0, until - Date.now());
  if (delay === 0) return;
  window.setTimeout(() => {
    if (Date.now() >= until) {
      setRampupWaitActiveUntil(null);
    }
  }, delay);
};

export const enterRampupGate = async (params: {
  code: string;
  url: string;
  enabled: boolean;
  timeoutMs?: number;
}): Promise<RampupGate | null> => {
  if (typeof window === "undefined") return null;
  const { code, url, enabled } = params;
  if (!enabled) return null;

  const windowMs = getRampupWindowMs();
  const startedAt = getSessionStartAt(code);
  const elapsed = Date.now() - startedAt;
  if (elapsed > windowMs) return null;

  const peerId = getPeerId(code);
  const response = await postRampup(
    "enter",
    { roomKey: code, peerId },
    params.timeoutMs ?? 1200,
  ).catch(() => null);

  if (!response?.ok) return null;

  const waitCap = getRampupMaxWaitMs();
  const recommendedWait = response.waitMs ?? getRampupWaitMs();
  const waitMs = Math.min(Math.max(recommendedWait, 0), waitCap);
  const windowRemainingMs =
    response.windowRemainingMs ??
    Math.max(0, windowMs - (Date.now() - startedAt));

  recordRampupEnter(response.slot, waitMs, windowRemainingMs);

  if (waitMs >= waitCap && recommendedWait > waitCap) {
    recordRampupMaxWaitHit();
  }

  if (response.slot === "wait" && waitMs > 0) {
    const set = getWaitSet(code);
    set.add(url);
    const until = Date.now() + waitMs;
    setRampupWaitActiveUntil(until);
    scheduleWaitIndicatorClear(until);
  }

  return {
    slot: response.slot,
    waitMs,
    token: response.token ?? null,
    issuedAt: response.issuedAt,
    windowRemainingMs: windowRemainingMs ?? null,
    leave: async () => {
      if (!response.token) return;
      try {
        await postRampup(
          "leave",
          { roomKey: code, peerId, token: response.token },
          1200,
        );
      } catch {
        // ignore leave failures
      }
    },
  };
};

export const hasAppliedRampupWait = (code: string, url: string) => {
  const set = waitAppliedUrls.get(code);
  return set?.has(url) ?? false;
};
