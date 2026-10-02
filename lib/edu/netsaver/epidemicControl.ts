import { hashRoomCodeShort } from "./hash";
import {
  getNetworkSaverMetricsSnapshot,
  setEpidemicDisabledUntil,
} from "./metrics";

const DISABLED_TTL_MS = 30 * 60 * 1000;
const DISCONNECT_WINDOW_MS = 2 * 60 * 1000;
const MAX_DISCONNECTS = 3;
const MAX_CONSECUTIVE_FAILS = 2;
const MAX_TIMEOUT_MS = 6_000;
const MAX_BYTES = 20 * 1024 * 1024;
const EFFECT_WINDOW_MS = 3 * 60 * 1000;

const STORAGE_PREFIX = "edu:netsaver:epidemicDisabled:";

type EpidemicState = {
  consecutiveFails: number;
  timeoutMs: number;
  disconnectTimestamps: number[];
  bytesSent: number;
  bytesOverLimitAt: number | null;
  hitBaseline: number;
};

const stateByCodeHash = new Map<string, EpidemicState>();

const getState = (codeHash: string) => {
  const existing = stateByCodeHash.get(codeHash);
  if (existing) return existing;
  const created: EpidemicState = {
    consecutiveFails: 0,
    timeoutMs: 0,
    disconnectTimestamps: [],
    bytesSent: 0,
    bytesOverLimitAt: null,
    hitBaseline: 0,
  };
  stateByCodeHash.set(codeHash, created);
  return created;
};

const buildKey = (codeHash: string) => `${STORAGE_PREFIX}${codeHash}`;

export const getEpidemicDisabledUntilByHash = (codeHash: string | null) => {
  if (!codeHash || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildKey(codeHash));
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    if (Date.now() > parsed) {
      window.localStorage.removeItem(buildKey(codeHash));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const setDisabledUntilByHash = (codeHash: string, until: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildKey(codeHash), String(until));
  } catch {
    // ignore storage failures
  }
  setEpidemicDisabledUntil(until);
};

export const disableEpidemicByHash = (codeHash: string) => {
  const disabledUntil = Date.now() + DISABLED_TTL_MS;
  setDisabledUntilByHash(codeHash, disabledUntil);
  return disabledUntil;
};

export const disableEpidemicForRoom = async (code: string) => {
  const codeHash = await hashRoomCodeShort(code, 8);
  if (!codeHash || codeHash === "-") return null;
  return disableEpidemicByHash(codeHash);
};

export const recordEpidemicSendSuccess = (codeHash: string | null, bytes: number) => {
  if (!codeHash) return;
  const state = getState(codeHash);
  state.consecutiveFails = 0;
  state.timeoutMs = 0;
  state.bytesSent += Math.max(0, bytes);

  if (state.bytesSent >= MAX_BYTES && state.bytesOverLimitAt === null) {
    state.bytesOverLimitAt = Date.now();
    state.hitBaseline = getNetworkSaverMetricsSnapshot().p2p.hitCount;
  }

  if (state.bytesOverLimitAt !== null) {
    const elapsed = Date.now() - state.bytesOverLimitAt;
    const hitCount = getNetworkSaverMetricsSnapshot().p2p.hitCount;
    if (elapsed >= EFFECT_WINDOW_MS && hitCount <= state.hitBaseline) {
      disableEpidemicByHash(codeHash);
    }
  }
};

export const recordEpidemicSendFailure = (
  codeHash: string | null,
  options?: { timeoutMs?: number },
) => {
  if (!codeHash) return;
  const state = getState(codeHash);
  state.consecutiveFails += 1;
  if (options?.timeoutMs) {
    state.timeoutMs += Math.max(0, options.timeoutMs);
  }
  if (state.timeoutMs >= MAX_TIMEOUT_MS || state.consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
    disableEpidemicByHash(codeHash);
  }
};

export const recordEpidemicDisconnect = (codeHash: string | null) => {
  if (!codeHash) return;
  const state = getState(codeHash);
  const now = Date.now();
  state.disconnectTimestamps = state.disconnectTimestamps.filter(
    (timestamp) => now - timestamp <= DISCONNECT_WINDOW_MS,
  );
  state.disconnectTimestamps.push(now);
  if (state.disconnectTimestamps.length >= MAX_DISCONNECTS) {
    disableEpidemicByHash(codeHash);
  }
};

export const refreshEpidemicDisabledUntil = (codeHash: string | null) => {
  const disabledUntil = getEpidemicDisabledUntilByHash(codeHash);
  setEpidemicDisabledUntil(disabledUntil);
  return disabledUntil;
};
