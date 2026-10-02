import type { NetworkSaverTier } from "./config";
import { hashRoomCodeShort } from "./hash";

export type NetworkSaverCodeOverride = {
  mode: "lease_only" | "auto";
  tier: NetworkSaverTier;
  updatedAt: number;
  ttlMs: number;
  disabledUntil?: number;
  reason?: string;
};

export const DEFAULT_CODE_OVERRIDE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STORAGE_PREFIX = "edu:netsaver:override:";

const buildKey = (codeHash: string) => `${STORAGE_PREFIX}${codeHash}`;

const resolveCodeHash = async (code: string) => {
  const hash = await hashRoomCodeShort(code, 8);
  if (!hash || hash === "-") return null;
  return hash;
};

const readStoredOverride = (key: string): NetworkSaverCodeOverride | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as NetworkSaverCodeOverride;
  } catch {
    return null;
  }
};

const writeStoredOverride = (key: string, override: NetworkSaverCodeOverride) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(override));
  } catch {
    // ignore storage failures
  }
};

const isOverrideValid = (override: NetworkSaverCodeOverride | null) => {
  if (!override) return false;
  if (!override.updatedAt || !override.ttlMs) return false;
  return override.updatedAt + override.ttlMs > Date.now();
};

export const loadNetworkSaverCodeOverride = async (code: string) => {
  if (typeof window === "undefined") return null;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return null;
  const key = buildKey(codeHash);
  const override = readStoredOverride(key);
  if (!isOverrideValid(override)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
    return { codeHash, override: null as NetworkSaverCodeOverride | null };
  }
  return { codeHash, override };
};

export const saveNetworkSaverCodeOverride = async (
  code: string,
  override: Omit<NetworkSaverCodeOverride, "updatedAt" | "ttlMs">,
  ttlMs = DEFAULT_CODE_OVERRIDE_TTL_MS,
) => {
  if (typeof window === "undefined") return null;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return null;
  const key = buildKey(codeHash);
  const payload: NetworkSaverCodeOverride = {
    mode: override.mode,
    tier: override.tier,
    disabledUntil: override.disabledUntil,
    reason: override.reason,
    updatedAt: Date.now(),
    ttlMs,
  };
  writeStoredOverride(key, payload);
  return { codeHash, override: payload };
};

export const clearNetworkSaverCodeOverride = async (code: string) => {
  if (typeof window === "undefined") return;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return;
  try {
    window.localStorage.removeItem(buildKey(codeHash));
  } catch {
    // ignore storage failures
  }
};
