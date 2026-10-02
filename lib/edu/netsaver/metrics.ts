import type { NetworkSaverMode, NetworkSaverTier } from "./config";

export type NetsaverMetricsSnapshot = {
  mode: NetworkSaverMode;
  tier: NetworkSaverTier;
  allowlistCount: number;
  boost: {
    startAt: number | null;
    durationMs: number;
    quietEnteredAt: number | null;
    rearmCount: number;
    lastRearmAt: number | null;
  };
  quietMode: {
    enabled: boolean;
    p2pSkippedCount: number;
  };
  wasm: {
    p2pEnabled: boolean;
    p2pHitCount: number;
    p2pFailCount: number;
    p2pRecent5m: number;
    originFetchCount: number;
    leaseWaitCount: number;
    leaseBypassCount: number;
    bytesFromPeers: number;
    bytesFromOrigin: number;
    lastErrorCode: string | null;
  };
  meta: {
    p2pHitCount: number;
    p2pFailCount: number;
    p2pRecent5m: number;
    originFetchCount: number;
    bytesFromPeers: number;
    bytesFromOrigin: number;
    byFilename: {
      "tokenizer.json": number;
      "tokenizer.model": number;
      "config.json": number;
      "vocab.json": number;
      "merges.txt": number;
    };
  };
  shard: {
    p2pHitCount: number;
    p2pFailCount: number;
    p2pRecent5m: number;
    originFetchCount: number;
    bytesFromPeers: number;
    bytesFromOrigin: number;
    tier3Disabled: boolean;
    tier3DisabledReason: string | null;
    blocklistCount: number;
    timeoutMsTotal: number;
  };
  rangeBypassCount: number;
  p2pProbe: {
    status: "idle" | "pass" | "fail";
    lastAt: number | null;
  };
  lease: {
    active: boolean;
    acquiredCount: number;
    waitCount: number;
    waitRecent5m: number;
    waitMsTotal: number;
    bypassCount: number;
    lastAcquiredAt: number | null;
  };
  rampup: {
    enabled: boolean;
    enterCount: number;
    originSlotCount: number;
    waitSlotCount: number;
    waitCount: number;
    waitMsTotal: number;
    maxWaitHitCount: number;
    windowRemainingMs: number | null;
    lastSlot: "origin" | "wait" | null;
    waitActiveUntil: number | null;
  };
  prewarm: {
    startedAt: number | null;
    okCount: number;
    failCount: number;
    lastErrorCode: string | null;
  };
  seedLite: {
    enabled: boolean;
    haveBroadcastCount: number;
    bytesSent: number;
    bytesSentRecent5m: number;
    wantServedCount: number;
    stopReason: string | null;
  };
  epidemic: {
    enabled: boolean;
    seedEligible: boolean;
    offersSent: number;
    offersAccepted: number;
    wantServedCount: number;
    bytesSent: number;
    disabledUntil: number | null;
  };
  jitterAppliedMs: number | null;
  origin: {
    totalCount: number;
    recent5m: number;
  };
  p2p: {
    hitCount: number;
    connectionCount: number;
    recent5m: number;
  };
  lastError: {
    code: string | null;
    message: string | null;
    at: number | null;
  };
};

type NetsaverMetricsState = {
  mode: NetworkSaverMode;
  tier: NetworkSaverTier;
  allowlistCount: number;
  boostStartAt: number | null;
  boostDurationMs: number;
  boostQuietEnteredAt: number | null;
  boostRearmCount: number;
  boostLastRearmAt: number | null;
  quietModeEnabled: boolean;
  quietModeP2PSkippedCount: number;
  wasmP2PEnabled: boolean;
  wasmP2PHitCount: number;
  wasmP2PFailCount: number;
  wasmOriginFetchCount: number;
  wasmLeaseWaitCount: number;
  wasmLeaseBypassCount: number;
  wasmBytesFromPeers: number;
  wasmBytesFromOrigin: number;
  wasmLastErrorCode: string | null;
  metaP2PHitCount: number;
  metaP2PFailCount: number;
  metaOriginFetchCount: number;
  metaBytesFromPeers: number;
  metaBytesFromOrigin: number;
  metaByFilename: {
    "tokenizer.json": number;
    "tokenizer.model": number;
    "config.json": number;
    "vocab.json": number;
    "merges.txt": number;
  };
  shardP2PHitCount: number;
  shardP2PFailCount: number;
  shardOriginFetchCount: number;
  shardBytesFromPeers: number;
  shardBytesFromOrigin: number;
  shardTier3Disabled: boolean;
  shardTier3DisabledReason: string | null;
  shardBlocklistCount: number;
  shardTimeoutMsTotal: number;
  rangeBypassCount: number;
  p2pProbeStatus: "idle" | "pass" | "fail";
  p2pProbeAt: number | null;
  leaseActive: boolean;
  leaseAcquiredCount: number;
  leaseWaitCount: number;
  leaseWaitMsTotal: number;
  leaseBypassCount: number;
  leaseLastAcquiredAt: number | null;
  rampupEnterCount: number;
  rampupOriginSlotCount: number;
  rampupWaitSlotCount: number;
  rampupWaitMsTotal: number;
  rampupMaxWaitHitCount: number;
  rampupWindowRemainingMs: number | null;
  rampupLastSlot: "origin" | "wait" | null;
  rampupWaitActiveUntil: number | null;
  rampupEnabled: boolean;
  prewarmStartedAt: number | null;
  prewarmOkCount: number;
  prewarmFailCount: number;
  prewarmLastErrorCode: string | null;
  seedLiteEnabled: boolean;
  seedLiteHaveBroadcastCount: number;
  seedLiteBytesSent: number;
  seedLiteBytesSentTimestamps: Array<{ at: number; bytes: number }>;
  seedLiteWantServedCount: number;
  seedLiteStopReason: string | null;
  epidemicEnabled: boolean;
  epidemicSeedEligible: boolean;
  epidemicOffersSent: number;
  epidemicOffersAccepted: number;
  epidemicWantServedCount: number;
  epidemicBytesSent: number;
  epidemicDisabledUntil: number | null;
  jitterAppliedMs: number | null;
  originFetchCount: number;
  p2pHitCount: number;
  p2pConnectionCount: number;
  lastError: { code: string | null; message: string | null; at: number | null };
  originTimestamps: number[];
  p2pTimestamps: number[];
  wasmP2PTimestamps: number[];
  metaP2PTimestamps: number[];
  shardP2PTimestamps: number[];
  leaseWaitTimestamps: number[];
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const STORAGE_KEY = "edu:netsaver:metrics";

const state: NetsaverMetricsState = {
  mode: "lease_only",
  tier: "meta",
  allowlistCount: 0,
  boostStartAt: null,
  boostDurationMs: 0,
  boostQuietEnteredAt: null,
  boostRearmCount: 0,
  boostLastRearmAt: null,
  quietModeEnabled: false,
  quietModeP2PSkippedCount: 0,
  wasmP2PEnabled: false,
  wasmP2PHitCount: 0,
  wasmP2PFailCount: 0,
  wasmOriginFetchCount: 0,
  wasmLeaseWaitCount: 0,
  wasmLeaseBypassCount: 0,
  wasmBytesFromPeers: 0,
  wasmBytesFromOrigin: 0,
  wasmLastErrorCode: null,
  metaP2PHitCount: 0,
  metaP2PFailCount: 0,
  metaOriginFetchCount: 0,
  metaBytesFromPeers: 0,
  metaBytesFromOrigin: 0,
  metaByFilename: {
    "tokenizer.json": 0,
    "tokenizer.model": 0,
    "config.json": 0,
    "vocab.json": 0,
    "merges.txt": 0,
  },
  shardP2PHitCount: 0,
  shardP2PFailCount: 0,
  shardOriginFetchCount: 0,
  shardBytesFromPeers: 0,
  shardBytesFromOrigin: 0,
  shardTier3Disabled: false,
  shardTier3DisabledReason: null,
  shardBlocklistCount: 0,
  shardTimeoutMsTotal: 0,
  rangeBypassCount: 0,
  p2pProbeStatus: "idle",
  p2pProbeAt: null,
  leaseActive: false,
  leaseAcquiredCount: 0,
  leaseWaitCount: 0,
  leaseWaitMsTotal: 0,
  leaseBypassCount: 0,
  leaseLastAcquiredAt: null,
  rampupEnterCount: 0,
  rampupOriginSlotCount: 0,
  rampupWaitSlotCount: 0,
  rampupWaitMsTotal: 0,
  rampupMaxWaitHitCount: 0,
  rampupWindowRemainingMs: null,
  rampupLastSlot: null,
  rampupWaitActiveUntil: null,
  rampupEnabled: false,
  prewarmStartedAt: null,
  prewarmOkCount: 0,
  prewarmFailCount: 0,
  prewarmLastErrorCode: null,
  seedLiteEnabled: false,
  seedLiteHaveBroadcastCount: 0,
  seedLiteBytesSent: 0,
  seedLiteBytesSentTimestamps: [],
  seedLiteWantServedCount: 0,
  seedLiteStopReason: null,
  epidemicEnabled: false,
  epidemicSeedEligible: false,
  epidemicOffersSent: 0,
  epidemicOffersAccepted: 0,
  epidemicWantServedCount: 0,
  epidemicBytesSent: 0,
  epidemicDisabledUntil: null,
  jitterAppliedMs: null,
  originFetchCount: 0,
  p2pHitCount: 0,
  p2pConnectionCount: 0,
  lastError: { code: null, message: null, at: null },
  originTimestamps: [],
  p2pTimestamps: [],
  wasmP2PTimestamps: [],
  metaP2PTimestamps: [],
  shardP2PTimestamps: [],
  leaseWaitTimestamps: [],
};

let persistTimer: number | null = null;

const now = () => Date.now();

const schedulePersist = () => {
  if (typeof window === "undefined") return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      const snapshot = getNetworkSaverMetricsSnapshot();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore storage failures
    }
  }, 500);
};

const trimOld = (list: number[], windowMs: number) => {
  const cutoff = now() - windowMs;
  while (list.length > 0 && list[0] < cutoff) {
    list.shift();
  }
};

const trimOldBytes = (list: Array<{ at: number; bytes: number }>, windowMs: number) => {
  const cutoff = now() - windowMs;
  while (list.length > 0 && list[0].at < cutoff) {
    list.shift();
  }
};

const resolveMetaFilenameKey = (url: string) => {
  try {
    const pathname = new URL(url, window.location.href).pathname.toLowerCase();
    if (pathname.endsWith("/tokenizer.json")) return "tokenizer.json";
    if (pathname.includes("/tokenizer.")) return "tokenizer.model";
    if (pathname.endsWith("/mlc-chat-config.json") || pathname.endsWith("/config.json")) {
      return "config.json";
    }
    if (pathname.endsWith("/vocab.json")) return "vocab.json";
    if (pathname.endsWith("/merges.txt")) return "merges.txt";
  } catch {
    return null;
  }
  return null;
};

const recordMetaFilename = (url?: string) => {
  if (!url) return;
  const key = resolveMetaFilenameKey(url);
  if (!key) return;
  state.metaByFilename[key] += 1;
};

export const setNetworkSaverMode = (mode: NetworkSaverMode) => {
  state.mode = mode;
  schedulePersist();
};

export const setNetworkSaverTier = (tier: NetworkSaverTier) => {
  state.tier = tier;
  schedulePersist();
};

export const setNetworkSaverAllowlistCount = (count: number) => {
  state.allowlistCount = Math.max(0, count);
  schedulePersist();
};

export const setBoostWindowMetrics = (data: {
  startAt: number | null;
  durationMs: number;
  quietEnteredAt: number | null;
  rearmCount: number;
  lastRearmAt: number | null;
}) => {
  state.boostStartAt = data.startAt;
  state.boostDurationMs = Math.max(0, data.durationMs);
  state.boostQuietEnteredAt = data.quietEnteredAt ?? null;
  state.boostRearmCount = Math.max(0, data.rearmCount);
  state.boostLastRearmAt = data.lastRearmAt ?? null;
  schedulePersist();
};

export const recordBoostRearm = () => {
  state.boostRearmCount += 1;
  state.boostLastRearmAt = now();
  schedulePersist();
};

export const setQuietModeEnabled = (enabled: boolean, enteredAt: number | null = null) => {
  state.quietModeEnabled = enabled;
  state.boostQuietEnteredAt = enabled ? enteredAt ?? now() : null;
  schedulePersist();
};

export const recordQuietModeP2PSkipped = () => {
  state.quietModeP2PSkippedCount += 1;
  schedulePersist();
};

export const setWasmP2PEnabled = (enabled: boolean) => {
  state.wasmP2PEnabled = enabled;
  schedulePersist();
};

export const recordWasmP2PHit = (bytes: number) => {
  state.wasmP2PHitCount += 1;
  state.wasmBytesFromPeers += bytes;
  state.wasmP2PTimestamps.push(now());
  trimOld(state.wasmP2PTimestamps, FIVE_MINUTES_MS);
  schedulePersist();
};

export const recordWasmP2PFail = () => {
  state.wasmP2PFailCount += 1;
  schedulePersist();
};

export const recordWasmOriginFetch = (bytes: number) => {
  state.wasmOriginFetchCount += 1;
  state.wasmBytesFromOrigin += bytes;
  schedulePersist();
};

export const recordWasmLeaseWait = () => {
  state.wasmLeaseWaitCount += 1;
  schedulePersist();
};

export const recordWasmLeaseBypass = () => {
  state.wasmLeaseBypassCount += 1;
  schedulePersist();
};

export const recordWasmErrorCode = (code: string) => {
  state.wasmLastErrorCode = code;
  schedulePersist();
};

export const recordMetaP2PHit = (bytes: number, url?: string) => {
  state.metaP2PHitCount += 1;
  state.metaBytesFromPeers += bytes;
  state.metaP2PTimestamps.push(now());
  trimOld(state.metaP2PTimestamps, FIVE_MINUTES_MS);
  recordMetaFilename(url);
  schedulePersist();
};

export const recordMetaP2PFail = () => {
  state.metaP2PFailCount += 1;
  schedulePersist();
};

export const recordMetaOriginFetch = (bytes: number, url?: string) => {
  state.metaOriginFetchCount += 1;
  state.metaBytesFromOrigin += bytes;
  recordMetaFilename(url);
  schedulePersist();
};

export const recordShardP2PHit = (bytes: number) => {
  state.shardP2PHitCount += 1;
  state.shardBytesFromPeers += bytes;
  state.shardP2PTimestamps.push(now());
  trimOld(state.shardP2PTimestamps, FIVE_MINUTES_MS);
  schedulePersist();
};

export const recordShardP2PFail = () => {
  state.shardP2PFailCount += 1;
  schedulePersist();
};

export const recordShardOriginFetch = (bytes: number) => {
  state.shardOriginFetchCount += 1;
  state.shardBytesFromOrigin += bytes;
  schedulePersist();
};

export const recordShardBlocklist = () => {
  state.shardBlocklistCount += 1;
  schedulePersist();
};

export const recordShardTimeout = (timeoutMs: number) => {
  state.shardTimeoutMsTotal += Math.max(0, timeoutMs);
  schedulePersist();
};

export const setShardBlocklistCount = (count: number) => {
  state.shardBlocklistCount = Math.max(0, count);
  schedulePersist();
};

export const setShardTier3Disabled = (disabled: boolean, reason?: string | null) => {
  state.shardTier3Disabled = disabled;
  state.shardTier3DisabledReason = disabled ? reason ?? "disabled" : null;
  schedulePersist();
};

export const recordRangeBypass = () => {
  state.rangeBypassCount += 1;
  schedulePersist();
};

export const recordP2PProbeResult = (status: "pass" | "fail") => {
  state.p2pProbeStatus = status;
  state.p2pProbeAt = now();
  schedulePersist();
};

export const setLeaseActive = (active: boolean) => {
  state.leaseActive = active;
  schedulePersist();
};

export const recordLeaseAcquired = () => {
  state.leaseAcquiredCount += 1;
  state.leaseLastAcquiredAt = now();
  state.leaseActive = true;
  schedulePersist();
};

export const recordLeaseWait = (waitMs: number) => {
  state.leaseWaitCount += 1;
  state.leaseWaitMsTotal += waitMs;
  state.leaseWaitTimestamps.push(now());
  trimOld(state.leaseWaitTimestamps, FIVE_MINUTES_MS);
  schedulePersist();
};

export const recordLeaseBypass = () => {
  state.leaseBypassCount += 1;
  schedulePersist();
};

export const recordRampupEnter = (
  slot: "origin" | "wait",
  waitMs: number,
  windowRemainingMs: number | null,
) => {
  state.rampupEnterCount += 1;
  if (slot === "origin") {
    state.rampupOriginSlotCount += 1;
  } else {
    state.rampupWaitSlotCount += 1;
  }
  if (waitMs > 0) {
    state.rampupWaitMsTotal += waitMs;
  }
  state.rampupLastSlot = slot;
  if (windowRemainingMs !== null) {
    state.rampupWindowRemainingMs = Math.max(0, windowRemainingMs);
  }
  schedulePersist();
};

export const recordRampupMaxWaitHit = () => {
  state.rampupMaxWaitHitCount += 1;
  schedulePersist();
};

export const setRampupEnabled = (enabled: boolean) => {
  state.rampupEnabled = enabled;
  schedulePersist();
};

export const setRampupWaitActiveUntil = (until: number | null) => {
  state.rampupWaitActiveUntil = until;
  schedulePersist();
};

export const recordPrewarmStart = () => {
  state.prewarmStartedAt = now();
  state.prewarmOkCount = 0;
  state.prewarmFailCount = 0;
  state.prewarmLastErrorCode = null;
  schedulePersist();
};

export const recordPrewarmResult = (
  okCount: number,
  failCount: number,
  lastErrorCode?: string | null,
) => {
  state.prewarmOkCount = Math.max(0, okCount);
  state.prewarmFailCount = Math.max(0, failCount);
  state.prewarmLastErrorCode = lastErrorCode ?? null;
  schedulePersist();
};

export const setSeedLiteEnabled = (enabled: boolean) => {
  state.seedLiteEnabled = enabled;
  if (!enabled) {
    state.seedLiteHaveBroadcastCount = 0;
    state.seedLiteBytesSent = 0;
    state.seedLiteBytesSentTimestamps = [];
    state.seedLiteWantServedCount = 0;
  }
  schedulePersist();
};

export const recordSeedLiteHaveBroadcast = () => {
  state.seedLiteHaveBroadcastCount += 1;
  schedulePersist();
};

export const recordSeedLiteBytesSent = (bytes: number) => {
  const safeBytes = Math.max(0, bytes);
  state.seedLiteBytesSent += safeBytes;
  state.seedLiteBytesSentTimestamps.push({ at: now(), bytes: safeBytes });
  trimOldBytes(state.seedLiteBytesSentTimestamps, FIVE_MINUTES_MS);
  schedulePersist();
};

export const recordSeedLiteWantServed = () => {
  state.seedLiteWantServedCount += 1;
  schedulePersist();
};

export const setSeedLiteStopReason = (reason: string | null) => {
  state.seedLiteStopReason = reason;
  schedulePersist();
};

export const setEpidemicEnabled = (enabled: boolean) => {
  state.epidemicEnabled = enabled;
  schedulePersist();
};

export const setEpidemicSeedEligible = (eligible: boolean) => {
  state.epidemicSeedEligible = eligible;
  schedulePersist();
};

export const recordEpidemicOfferSent = () => {
  state.epidemicOffersSent += 1;
  schedulePersist();
};

export const recordEpidemicOfferAccepted = () => {
  state.epidemicOffersAccepted += 1;
  schedulePersist();
};

export const recordEpidemicWantServed = () => {
  state.epidemicWantServedCount += 1;
  schedulePersist();
};

export const recordEpidemicBytesSent = (bytes: number) => {
  state.epidemicBytesSent += Math.max(0, bytes);
  schedulePersist();
};

export const setEpidemicDisabledUntil = (disabledUntil: number | null) => {
  state.epidemicDisabledUntil = disabledUntil;
  schedulePersist();
};

export const recordStudentJitterApplied = (jitterMs: number) => {
  state.jitterAppliedMs = Math.max(0, jitterMs);
  schedulePersist();
};

export const recordOriginFetch = () => {
  state.originFetchCount += 1;
  state.originTimestamps.push(now());
  trimOld(state.originTimestamps, FIVE_MINUTES_MS);
  schedulePersist();
};

export const recordP2PHit = () => {
  state.p2pHitCount += 1;
  state.p2pTimestamps.push(now());
  trimOld(state.p2pTimestamps, FIVE_MINUTES_MS);
  schedulePersist();
};

export const setP2PConnectionCount = (count: number) => {
  state.p2pConnectionCount = Math.max(0, count);
  schedulePersist();
};

export const recordNetworkSaverError = (code: string, message: string) => {
  state.lastError = { code, message, at: now() };
  schedulePersist();
};

export const getNetworkSaverMetricsSnapshot = (): NetsaverMetricsSnapshot => {
  trimOld(state.originTimestamps, FIVE_MINUTES_MS);
  trimOld(state.p2pTimestamps, FIVE_MINUTES_MS);
  trimOld(state.wasmP2PTimestamps, FIVE_MINUTES_MS);
  trimOld(state.metaP2PTimestamps, FIVE_MINUTES_MS);
  trimOld(state.shardP2PTimestamps, FIVE_MINUTES_MS);
  trimOld(state.leaseWaitTimestamps, FIVE_MINUTES_MS);
  trimOldBytes(state.seedLiteBytesSentTimestamps, FIVE_MINUTES_MS);
  const seedLiteRecentBytes = state.seedLiteBytesSentTimestamps.reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  );
  return {
    mode: state.mode,
    tier: state.tier,
    allowlistCount: state.allowlistCount,
    boost: {
      startAt: state.boostStartAt,
      durationMs: state.boostDurationMs,
      quietEnteredAt: state.boostQuietEnteredAt,
      rearmCount: state.boostRearmCount,
      lastRearmAt: state.boostLastRearmAt,
    },
    quietMode: {
      enabled: state.quietModeEnabled,
      p2pSkippedCount: state.quietModeP2PSkippedCount,
    },
    wasm: {
      p2pEnabled: state.wasmP2PEnabled,
      p2pHitCount: state.wasmP2PHitCount,
      p2pFailCount: state.wasmP2PFailCount,
      p2pRecent5m: state.wasmP2PTimestamps.length,
      originFetchCount: state.wasmOriginFetchCount,
      leaseWaitCount: state.wasmLeaseWaitCount,
      leaseBypassCount: state.wasmLeaseBypassCount,
      bytesFromPeers: state.wasmBytesFromPeers,
      bytesFromOrigin: state.wasmBytesFromOrigin,
      lastErrorCode: state.wasmLastErrorCode,
    },
    meta: {
      p2pHitCount: state.metaP2PHitCount,
      p2pFailCount: state.metaP2PFailCount,
      p2pRecent5m: state.metaP2PTimestamps.length,
      originFetchCount: state.metaOriginFetchCount,
      bytesFromPeers: state.metaBytesFromPeers,
      bytesFromOrigin: state.metaBytesFromOrigin,
      byFilename: { ...state.metaByFilename },
    },
    shard: {
      p2pHitCount: state.shardP2PHitCount,
      p2pFailCount: state.shardP2PFailCount,
      p2pRecent5m: state.shardP2PTimestamps.length,
      originFetchCount: state.shardOriginFetchCount,
      bytesFromPeers: state.shardBytesFromPeers,
      bytesFromOrigin: state.shardBytesFromOrigin,
      tier3Disabled: state.shardTier3Disabled,
      tier3DisabledReason: state.shardTier3DisabledReason,
      blocklistCount: state.shardBlocklistCount,
      timeoutMsTotal: state.shardTimeoutMsTotal,
    },
    rangeBypassCount: state.rangeBypassCount,
    p2pProbe: {
      status: state.p2pProbeStatus,
      lastAt: state.p2pProbeAt,
    },
    lease: {
      active: state.leaseActive,
      acquiredCount: state.leaseAcquiredCount,
      waitCount: state.leaseWaitCount,
      waitRecent5m: state.leaseWaitTimestamps.length,
      waitMsTotal: state.leaseWaitMsTotal,
      bypassCount: state.leaseBypassCount,
      lastAcquiredAt: state.leaseLastAcquiredAt,
    },
    rampup: {
      enabled: state.rampupEnabled,
      enterCount: state.rampupEnterCount,
      originSlotCount: state.rampupOriginSlotCount,
      waitSlotCount: state.rampupWaitSlotCount,
      waitCount: state.rampupWaitSlotCount,
      waitMsTotal: state.rampupWaitMsTotal,
      maxWaitHitCount: state.rampupMaxWaitHitCount,
      windowRemainingMs: state.rampupWindowRemainingMs,
      lastSlot: state.rampupLastSlot,
      waitActiveUntil: state.rampupWaitActiveUntil,
    },
    prewarm: {
      startedAt: state.prewarmStartedAt,
      okCount: state.prewarmOkCount,
      failCount: state.prewarmFailCount,
      lastErrorCode: state.prewarmLastErrorCode,
    },
    seedLite: {
      enabled: state.seedLiteEnabled,
      haveBroadcastCount: state.seedLiteHaveBroadcastCount,
      bytesSent: state.seedLiteBytesSent,
      bytesSentRecent5m: seedLiteRecentBytes,
      wantServedCount: state.seedLiteWantServedCount,
      stopReason: state.seedLiteStopReason,
    },
    epidemic: {
      enabled: state.epidemicEnabled,
      seedEligible: state.epidemicSeedEligible,
      offersSent: state.epidemicOffersSent,
      offersAccepted: state.epidemicOffersAccepted,
      wantServedCount: state.epidemicWantServedCount,
      bytesSent: state.epidemicBytesSent,
      disabledUntil: state.epidemicDisabledUntil,
    },
    jitterAppliedMs: state.jitterAppliedMs,
    origin: {
      totalCount: state.originFetchCount,
      recent5m: state.originTimestamps.length,
    },
    p2p: {
      hitCount: state.p2pHitCount,
      connectionCount: state.p2pConnectionCount,
      recent5m: state.p2pTimestamps.length,
    },
    lastError: state.lastError,
  };
};

export const readPersistedNetworkSaverMetrics = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as NetsaverMetricsSnapshot;
  } catch {
    return null;
  }
};
