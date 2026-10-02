export type NetworkSaverMode = "off" | "lease_only" | "auto" | "force_p2p" | "p2p";
export type NetworkSaverTier = "wasm" | "meta" | "small_shards";

type NetworkSaverUserFlags = {
  enabled: boolean;
  mode: "lease_only" | "auto";
  tier: NetworkSaverTier;
  maxBytes: number;
};

const DEFAULT_MODE: NetworkSaverMode = "lease_only";

const DEFAULT_LEASE_TTL_MS = 45_000;
const DEFAULT_LEASE_RENEW_MS = 20_000;
const DEFAULT_P2P_PROBE_TIMEOUT_MS = 2_500;
const DEFAULT_P2P_GRACE_MS = 250;
const DEFAULT_P2P_TIER: NetworkSaverTier = "meta";
const DEFAULT_P2P_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_SMALL_SHARD_TIMEOUT_MS = 3_500;
const DEFAULT_SMALL_SHARD_GRACE_MS = 400;
const DEFAULT_RAMPUP_WINDOW_MS = 120_000;
const DEFAULT_RAMPUP_WAIT_MS = 2_500;
const DEFAULT_RAMPUP_MAX_WAIT_MS = 8_000;
const DEFAULT_RAMPUP_ENABLED = true;
const DEFAULT_STUDENT_JITTER_MIN_MS = 0;
const DEFAULT_STUDENT_JITTER_MAX_MS = 1_200;

let runtimeUserFlags: NetworkSaverUserFlags | null = null;

const readNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readNumberAllowZero = (value: string | undefined, fallback: number) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const readBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeTier = (tier?: string | null): NetworkSaverTier => {
  if (tier === "wasm" || tier === "small_shards") return tier;
  return "meta";
};

const normalizeMode = (mode?: string | null): "lease_only" | "auto" => {
  if (mode === "auto") return "auto";
  return "lease_only";
};

export const setNetworkSaverUserFlags = (flags: {
  enabled?: boolean;
  mode?: string | null;
  tier?: string | null;
  maxBytes?: number | null;
} | null) => {
  if (!flags) {
    runtimeUserFlags = null;
    return;
  }
  runtimeUserFlags = {
    enabled: flags.enabled === true,
    mode: normalizeMode(flags.mode),
    tier: normalizeTier(flags.tier),
    maxBytes: Math.max(1, Math.floor(flags.maxBytes ?? DEFAULT_P2P_MAX_BYTES)),
  };
};

export const isNetworkSaverPilotEnabled = () => runtimeUserFlags?.enabled === true;

export const getConfiguredNetworkSaverMode = (): NetworkSaverMode => {
  if (!isNetworkSaverPilotEnabled()) return "off";
  return runtimeUserFlags?.mode ?? DEFAULT_MODE;
};

export const resolveNetworkSaverMode = (mode: NetworkSaverMode, isTeacher: boolean) => {
  if (mode === "force_p2p" && !isTeacher) return "auto" as const;
  return mode;
};

export const getLeaseTtlMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_LEASE_TTL_MS, DEFAULT_LEASE_TTL_MS);

export const getLeaseRenewMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_LEASE_RENEW_MS, DEFAULT_LEASE_RENEW_MS);

export const getP2PProbeTimeoutMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_P2P_PROBE_TIMEOUT_MS, DEFAULT_P2P_PROBE_TIMEOUT_MS);

export const getP2PGraceMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_P2P_GRACE_MS, DEFAULT_P2P_GRACE_MS);

export const getP2PTier = (): NetworkSaverTier => {
  if (!isNetworkSaverPilotEnabled()) return DEFAULT_P2P_TIER;
  return runtimeUserFlags?.tier ?? DEFAULT_P2P_TIER;
};

export const getP2PMaxBytes = () =>
  isNetworkSaverPilotEnabled() ? runtimeUserFlags?.maxBytes ?? DEFAULT_P2P_MAX_BYTES : DEFAULT_P2P_MAX_BYTES;

export const getSmallShardTimeoutMs = () =>
  readNumber(
    process.env.NEXT_PUBLIC_EDU_NETSAVER_P2P_SMALLSHARD_TIMEOUT_MS,
    DEFAULT_SMALL_SHARD_TIMEOUT_MS,
  );

export const getSmallShardGraceMs = () =>
  readNumber(
    process.env.NEXT_PUBLIC_EDU_NETSAVER_P2P_SMALLSHARD_GRACE_MS,
    DEFAULT_SMALL_SHARD_GRACE_MS,
  );

export const getRampupWindowMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_RAMPUP_WINDOW_MS, DEFAULT_RAMPUP_WINDOW_MS);

export const getRampupWaitMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_RAMPUP_WAIT_MS, DEFAULT_RAMPUP_WAIT_MS);

export const getRampupMaxWaitMs = () =>
  readNumber(process.env.NEXT_PUBLIC_EDU_RAMPUP_MAX_WAIT_MS, DEFAULT_RAMPUP_MAX_WAIT_MS);

export const getRampupEnabledDefault = () =>
  readBoolean(process.env.NEXT_PUBLIC_EDU_RAMPUP_ENABLED, DEFAULT_RAMPUP_ENABLED);

export const getStudentJitterMinMs = () =>
  readNumberAllowZero(
    process.env.NEXT_PUBLIC_EDU_NETSAVER_STUDENT_JITTER_MIN_MS,
    DEFAULT_STUDENT_JITTER_MIN_MS,
  );

export const getStudentJitterMaxMs = () =>
  readNumberAllowZero(
    process.env.NEXT_PUBLIC_EDU_NETSAVER_STUDENT_JITTER_MAX_MS,
    DEFAULT_STUDENT_JITTER_MAX_MS,
  );
