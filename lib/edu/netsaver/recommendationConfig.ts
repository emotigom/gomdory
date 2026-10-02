import { getWebllmPaths } from "../llm/webllmConfig";
import type { NetworkSaverMode, NetworkSaverTier } from "./config";
import { hashRoomCodeShort } from "./hash";

export type NetworkSaverStoredConfig = {
  mode: NetworkSaverMode;
  tier: NetworkSaverTier;
  allowlist: string[];
  rampupEnabled?: boolean;
  updatedAt: number;
  ttlMs: number;
};

const STORAGE_PREFIX = "edu:netsaver:config:";
const OVERRIDE_KEY = "edu:netsaver:override";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEGRADED_TTL_MS = 30 * 60 * 1000;

const buildKey = (codeHash: string) => `${STORAGE_PREFIX}${codeHash}`;

const resolveCodeHash = async (code: string) => {
  const hash = await hashRoomCodeShort(code, 8);
  if (!hash || hash === "-") return null;
  return hash;
};

const normalizeAllowlist = (allowlist: string[]) => {
  const normalized = new Set<string>();
  for (const entry of allowlist) {
    if (!entry) continue;
    if (entry.startsWith("/")) {
      normalized.add(entry.split("?")[0]);
      continue;
    }
    try {
      const parsed = new URL(entry);
      normalized.add(parsed.pathname);
    } catch {
      // ignore invalid entries
    }
  }
  return Array.from(normalized);
};

const readStoredConfig = (key: string): NetworkSaverStoredConfig | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as NetworkSaverStoredConfig;
  } catch {
    return null;
  }
};

const writeStoredConfig = (key: string, config: NetworkSaverStoredConfig) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // ignore storage failures
  }
};

const isValidConfig = (config: NetworkSaverStoredConfig | null) => {
  if (!config) return false;
  if (!config.updatedAt || !config.ttlMs) return false;
  return config.updatedAt + config.ttlMs > Date.now();
};

export const loadNetworkSaverOverride = (): NetworkSaverStoredConfig | null => {
  const config = readStoredConfig(OVERRIDE_KEY);
  if (!config) return null;
  return isValidConfig(config) ? config : null;
};

export const loadNetworkSaverConfig = async (code: string) => {
  if (typeof window === "undefined") return null;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return null;
  const key = buildKey(codeHash);
  const config = readStoredConfig(key);
  if (!isValidConfig(config)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
    return { codeHash, config: null as NetworkSaverStoredConfig | null };
  }
  return { codeHash, config };
};

export const saveNetworkSaverConfig = async (
  code: string,
  config: Omit<NetworkSaverStoredConfig, "updatedAt" | "ttlMs">,
  ttlMs = DEFAULT_TTL_MS,
) => {
  if (typeof window === "undefined") return null;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return null;
  const key = buildKey(codeHash);
  const payload: NetworkSaverStoredConfig = {
    mode: config.mode,
    tier: config.tier,
    allowlist: normalizeAllowlist(config.allowlist),
    rampupEnabled: config.rampupEnabled,
    updatedAt: Date.now(),
    ttlMs,
  };
  writeStoredConfig(key, payload);
  return { codeHash, config: payload };
};

export const saveDegradedNetworkSaverConfig = async (code: string) =>
  saveNetworkSaverConfig(code, { mode: "lease_only", tier: "meta", allowlist: [] }, DEGRADED_TTL_MS);

export const clearNetworkSaverConfig = async (code: string) => {
  if (typeof window === "undefined") return;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return;
  try {
    window.localStorage.removeItem(buildKey(codeHash));
  } catch {
    // ignore storage failures
  }
};

export const resolveAllowlistUrls = (allowlist: string[]) => {
  if (allowlist.length === 0) return [] as string[];
  try {
    const paths = getWebllmPaths();
    return allowlist
      .map((pathname) => {
        if (!pathname.startsWith("/")) return null;
        try {
          return new URL(pathname, paths.modelBase).href;
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value));
  } catch {
    return [] as string[];
  }
};
