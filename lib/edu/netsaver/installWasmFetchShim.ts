import { getP2PGraceMs, getSmallShardTimeoutMs, type NetworkSaverTier } from "./config";
import { ensureLease, markLeaseRelevantFetch, maybeRenewLease } from "./leaseManager";
import {
  recordNetworkSaverError,
  recordOriginFetch,
  recordMetaOriginFetch,
  recordMetaP2PFail,
  recordMetaP2PHit,
  recordShardBlocklist,
  recordShardOriginFetch,
  recordShardP2PFail,
  recordShardP2PHit,
  recordShardTimeout,
  recordRangeBypass,
  recordWasmErrorCode,
  recordWasmLeaseBypass,
  recordWasmLeaseWait,
  recordWasmOriginFetch,
  recordWasmP2PFail,
  recordWasmP2PHit,
  recordP2PHit,
  recordQuietModeP2PSkipped,
  setNetworkSaverTier,
  setShardBlocklistCount,
  setShardTier3Disabled,
  setWasmP2PEnabled,
} from "./metrics";
import { getActiveWasmSwarm } from "./wasmSwarm";
import { getWasmAllowlist } from "./wasmAllowlist";
import {
  getP2PResourceKindForUrl,
  getP2PResourceLimits,
  isP2PResourceCandidate,
  shouldP2PResource,
} from "./shouldP2PResource";
import { blockP2PUrl, countP2PBlocklistEntries, isP2PBlocked } from "./p2pBlocklist";
import { getTier3DisabledState, setTier3Disabled } from "./tier3Guard";
import { recordResourceJournalEntry } from "./resourceJournal";
import { enterRampupGate, hasAppliedRampupWait } from "./rampupClient";
import { recordSeedableReceive } from "./seedPolicy";
import { clearNetworkPrepStatus, setNetworkPrepStatus } from "./status";
import {
  recordAutoDowngradeWasmFailure,
  recordAutoDowngradeWasmSuccess,
} from "./autoDowngrade";
import { syncQuietModeFromBoost } from "./boostWindow";

const WASM_CONTENT_TYPE = "application/wasm";
const LEASE_MAX_WAIT_MS = 4_000;
const RESOURCE_LEASE_MAX_WAIT_MS = 5_000;
const ORIGIN_TIMEOUT_MS = 12_000;
const P2P_RECEIVE_TIMEOUT_BASE_MS = 2_000;
const P2P_RECEIVE_TIMEOUT_MAX_MS = 3_000;
const HEAD_TIMEOUT_MS = 1_200;
const SMALL_SHARD_FAIL_DISABLE_COUNT = 3;
const SMALL_SHARD_TIMEOUT_DISABLE_MS = 10_000;
const SMALL_SHARD_CONSECUTIVE_FAIL_COUNT = 2;

let originalFetch: typeof fetch | null = null;
let smallShardReceiveQueue: Promise<void> = Promise.resolve();
const tier3FailureState = new Map<string, Tier3FailureState>();

type Tier3FailureState = {
  failCount: number;
  timeoutMs: number;
  lastUrl: string | null;
  consecutiveUrlFails: number;
};

const getTier3FailureState = (code: string) => {
  const existing = tier3FailureState.get(code);
  if (existing) return existing;
  const state: Tier3FailureState = {
    failCount: 0,
    timeoutMs: 0,
    lastUrl: null,
    consecutiveUrlFails: 0,
  };
  tier3FailureState.set(code, state);
  return state;
};

const getBaseFetch = () => {
  if (!originalFetch) {
    originalFetch = window.fetch.bind(window);
  }
  return originalFetch;
};

const toAbsoluteUrl = (url: string) => {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

const resolveAllowlist = () => getWasmAllowlist();

const isWasmMagic = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 4) return false;
  const magic = new Uint8Array(buffer.slice(0, 4));
  return magic[0] === 0x00 && magic[1] === 0x61 && magic[2] === 0x73 && magic[3] === 0x6d;
};

const bufferToResponse = (buffer: ArrayBuffer) =>
  new Response(buffer, {
    headers: {
      "content-type": WASM_CONTENT_TYPE,
    },
  });

const bufferToResourceResponse = (buffer: ArrayBuffer, contentType?: string | null) =>
  new Response(buffer, {
    headers: contentType ? { "content-type": contentType } : undefined,
  });

const getRequestMethod = (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
};

const mergeHeaders = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers();
  if (input instanceof Request) {
    input.headers.forEach((value, key) => headers.set(key, value));
  }
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => headers.set(key, value));
  }
  return headers;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const withSmallShardReceiveLock = async <T>(task: () => Promise<T>) => {
  const prior = smallShardReceiveQueue;
  let release: () => void = () => {};
  smallShardReceiveQueue = new Promise((resolve) => {
    release = resolve;
  });
  await prior;
  try {
    return await task();
  } finally {
    release?.();
  }
};

const resolveTierForRequest = (code: string, configuredTier: NetworkSaverTier) => {
  if (configuredTier !== "small_shards") return configuredTier;
  const disabledState = getTier3DisabledState(code);
  setShardTier3Disabled(disabledState.disabled, disabledState.reason ?? null);
  const resolved = disabledState.disabled ? "meta" : "small_shards";
  setNetworkSaverTier(resolved);
  return resolved;
};

const recordTier3Failure = (code: string, url: string, timeoutMs = 0) => {
  const state = getTier3FailureState(code);
  state.failCount += 1;
  state.timeoutMs += timeoutMs;
  if (state.lastUrl === url) {
    state.consecutiveUrlFails += 1;
  } else {
    state.lastUrl = url;
    state.consecutiveUrlFails = 1;
  }
  const timedOut = state.timeoutMs >= SMALL_SHARD_TIMEOUT_DISABLE_MS;
  const failedTooMuch = state.failCount >= SMALL_SHARD_FAIL_DISABLE_COUNT;
  const repeatedUrl = state.consecutiveUrlFails >= SMALL_SHARD_CONSECUTIVE_FAIL_COUNT;
  if (timedOut || failedTooMuch || repeatedUrl) {
    const reason = timedOut ? "timeout_budget" : failedTooMuch ? "fail_count" : "repeat_fail";
    setTier3Disabled(code, reason);
    setShardTier3Disabled(true, reason);
  }
  if (timeoutMs > 0) {
    recordShardTimeout(timeoutMs);
  }
};
const getReceiveTimeoutMs = (size: number | null) => {
  if (!size) return P2P_RECEIVE_TIMEOUT_BASE_MS;
  const extra = Math.min(Math.max(Math.ceil(size / (2 * 1024 * 1024)) * 500, 0), 1_000);
  return Math.min(P2P_RECEIVE_TIMEOUT_BASE_MS + extra, P2P_RECEIVE_TIMEOUT_MAX_MS);
};

const inferContentType = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".model")) return "application/octet-stream";
  return undefined;
};

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit | undefined) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);
  try {
    return await getBaseFetch()(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchHeadWithTimeout = async (input: RequestInfo | URL, init: RequestInit | undefined) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    return await getBaseFetch()(input, { ...init, method: "HEAD", signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const waitForP2P = async (url: string, timeoutMs: number) => {
  const swarm = getActiveWasmSwarm();
  if (!swarm) {
    throw new Error("p2p_unavailable");
  }
  return swarm.waitForHave(url, timeoutMs);
};

const requestFromPeer = async (url: string, _peerId: string, timeoutMs: number) => {
  const swarm = getActiveWasmSwarm();
  if (!swarm) {
    throw new Error("p2p_unavailable");
  }
  return swarm.requestWasm(url, timeoutMs, { offerWindowMs: OFFER_WINDOW_MS });
};

const OFFER_WINDOW_MS = 150;

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const computeSha256 = async (buffer: ArrayBuffer) => {
  if (!window.crypto?.subtle) return null;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const shouldSkip = buffer.byteLength > 4 * 1024 * 1024 && deviceMemory && deviceMemory < 4;
  if (shouldSkip) return null;
  try {
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return toHex(digest);
  } catch {
    return null;
  }
};

const isJsonPayload = (url: string) => url.toLowerCase().endsWith(".json");

const validateResourceBuffer = (url: string, buffer: ArrayBuffer) => {
  if (!isJsonPayload(url)) return true;
  try {
    const text = new TextDecoder().decode(buffer);
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

export const installWasmFetchShim = (
  code: string,
  options: {
    p2pEnabled: boolean;
    tier: NetworkSaverTier;
    rampupEnabled: boolean;
    quietMode?: boolean;
  },
) => {
  if (typeof window === "undefined") return;
  const allowed = resolveAllowlist();
  if (allowed.size === 0) return;

  const initialQuietMode = options.quietMode ?? false;
  setWasmP2PEnabled(options.p2pEnabled && !initialQuietMode);
  const baseFetch = getBaseFetch();
  const graceMs = initialQuietMode ? 0 : clamp(getP2PGraceMs(), 250, 500);
  const smallShardTimeoutMs = clamp(getSmallShardTimeoutMs(), 2000, 4000);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = toAbsoluteUrl(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const method = getRequestMethod(input, init);
    const headers = mergeHeaders(input, init);
    const isRange = headers.has("range");
    const isWasm = allowed.has(url);
    const isResourceCandidate = isP2PResourceCandidate(url);
    const tierForRequest = resolveTierForRequest(code, options.tier);
    const requestStartedAt = performance.now();
    const recordJournal = (data: {
      source: "origin" | "p2p" | "cache";
      status?: number | null;
      contentLength?: number | null;
      contentType?: string | null;
      kindGuess?: "wasm" | "meta" | "small_shard" | "unknown";
    }) => {
      void recordResourceJournalEntry({
        code,
        url,
        source: data.source,
        status: data.status ?? null,
        contentLength: data.contentLength ?? null,
        contentType: data.contentType ?? null,
        durationMs: Math.round(performance.now() - requestStartedAt),
        rangeRequested: isRange,
        kindGuess: data.kindGuess,
      });
    };

    if (isRange && (isWasm || isResourceCandidate)) {
      recordRangeBypass();
      return baseFetch(input, init);
    }

    if (method !== "GET") {
      return baseFetch(input, init);
    }

    if (!isWasm && !isResourceCandidate) {
      return baseFetch(input, init);
    }

    const syncQuiet = syncQuietModeFromBoost(code);
    const quietMode = (options.quietMode ?? false) || syncQuiet.enabled;
    const p2pEnabled = options.p2pEnabled && !quietMode;
    setWasmP2PEnabled(p2pEnabled);
    const swarm = getActiveWasmSwarm();
    const canRampup = options.rampupEnabled && !quietMode && !hasAppliedRampupWait(code, url);

    const attemptWasmP2P = async (waitMs: number) => {
      if (!p2pEnabled || !swarm) return null;
      try {
        swarm.broadcastWant(url);
        const peerId = await waitForP2P(url, waitMs);
        if (peerId) {
          try {
            const receiveTimeoutMs = getReceiveTimeoutMs(null);
            const buffer = await requestFromPeer(url, peerId, receiveTimeoutMs);
            if (buffer && isWasmMagic(buffer)) {
              await swarm.storeWasm(url, buffer);
              swarm.broadcastHave(url, buffer.byteLength, { kind: "wasm" });
              recordWasmP2PHit(buffer.byteLength);
              recordP2PHit();
              recordAutoDowngradeWasmSuccess(code);
              recordJournal({
                source: "p2p",
                status: 200,
                contentLength: buffer.byteLength,
                contentType: WASM_CONTENT_TYPE,
                kindGuess: "wasm",
              });
              return bufferToResponse(buffer);
            }
            recordWasmP2PFail();
            recordWasmErrorCode("p2p_invalid_wasm");
            void recordAutoDowngradeWasmFailure(code);
          } catch (error) {
            recordWasmP2PFail();
            const message = error instanceof Error ? error.message : "p2p_receive_failed";
            recordWasmErrorCode(message);
            const isTimeout = message.includes("timeout");
            void recordAutoDowngradeWasmFailure(code, {
              timeoutMs: isTimeout ? getReceiveTimeoutMs(null) : 0,
            });
            return null;
          }
          recordWasmP2PFail();
          recordWasmErrorCode("p2p_invalid_wasm");
          void recordAutoDowngradeWasmFailure(code);
        }
      } catch (error) {
        recordWasmP2PFail();
        const message = error instanceof Error ? error.message : "p2p_receive_failed";
        recordWasmErrorCode(message);
        const isTimeout = message.includes("timeout");
        void recordAutoDowngradeWasmFailure(code, {
          timeoutMs: isTimeout ? getReceiveTimeoutMs(null) : 0,
        });
      }
      recordJournal({ source: "p2p", status: 0, kindGuess: "wasm" });
      return null;
    };

    const attemptResourceP2P = async (
      kind: "meta" | "small_shard",
      contentLength: number | null,
      contentType: string | null,
    ) => {
      if (!p2pEnabled || !swarm) return null;
      if (kind === "small_shard") {
        const shardResult = await withSmallShardReceiveLock(async () => {
          try {
            const result = await swarm.requestResource(url, smallShardTimeoutMs, {
              offerWindowMs: OFFER_WINDOW_MS,
            });
            const buffer = result.buffer;
            if (contentLength && buffer.byteLength !== contentLength) {
              throw new Error("p2p_size_mismatch");
            }
            const computedSha = await computeSha256(buffer);
            await swarm.storeResource(url, buffer, {
              size: buffer.byteLength,
              lastAccess: Date.now(),
              contentType: contentType ?? undefined,
              sha256: computedSha ?? undefined,
              kind: "small_shard",
            });
            swarm.broadcastHave(url, buffer.byteLength, {
              kind: "small_shard",
              contentType: contentType ?? undefined,
              sha256: computedSha ?? undefined,
            });
            recordShardP2PHit(buffer.byteLength);
            recordP2PHit();
            recordJournal({
              source: "p2p",
              status: 200,
              contentLength: buffer.byteLength,
              contentType: contentType,
              kindGuess: "small_shard",
            });
            return bufferToResourceResponse(buffer, contentType);
          } catch (error) {
            recordShardP2PFail();
            const message = error instanceof Error ? error.message : "p2p_receive_failed";
            const isTimeout = message.includes("timeout");
            recordTier3Failure(code, url, isTimeout ? smallShardTimeoutMs : 0);
            blockP2PUrl(code, url, message);
            recordShardBlocklist();
            setShardBlocklistCount(countP2PBlocklistEntries(code));
            recordNetworkSaverError("SHARD_P2P", message);
            recordJournal({ source: "p2p", status: 0, kindGuess: "small_shard" });
            return null;
          }
        });
        if (shardResult) {
          return shardResult;
        }
        return null;
      }

      try {
        const result = await swarm.requestResource(url, getReceiveTimeoutMs(contentLength), {
          offerWindowMs: OFFER_WINDOW_MS,
        });
        const buffer = result.buffer;
        if (contentLength && buffer.byteLength !== contentLength) {
          throw new Error("p2p_size_mismatch");
        }
        if (!validateResourceBuffer(url, buffer)) {
          throw new Error("p2p_invalid_payload");
        }
        const sha256 = result.meta.sha256 ?? null;
        if (sha256) {
          const computed = await computeSha256(buffer);
          if (computed && computed !== sha256) {
            throw new Error("p2p_sha_mismatch");
          }
        }
        const computedSha = sha256 ?? (await computeSha256(buffer));
        await swarm.storeResource(url, buffer, {
          size: buffer.byteLength,
          lastAccess: Date.now(),
          contentType: contentType ?? undefined,
          sha256: computedSha ?? undefined,
          kind: "meta",
        });
        swarm.broadcastHave(url, buffer.byteLength, {
          kind: "meta",
          contentType: contentType ?? undefined,
          sha256: computedSha ?? undefined,
        });
        recordMetaP2PHit(buffer.byteLength, url);
        recordP2PHit();
        recordSeedableReceive("meta");
        recordJournal({
          source: "p2p",
          status: 200,
          contentLength: buffer.byteLength,
          contentType: contentType,
          kindGuess: "meta",
        });
        return bufferToResourceResponse(buffer, contentType);
      } catch (error) {
        recordMetaP2PFail();
        const message = error instanceof Error ? error.message : "p2p_receive_failed";
        blockP2PUrl(code, url, message);
        recordShardBlocklist();
        setShardBlocklistCount(countP2PBlocklistEntries(code));
        recordNetworkSaverError("META_P2P", message);
        recordJournal({ source: "p2p", status: 0, kindGuess: "meta" });
      }
      return null;
    };

    if (isWasm) {
      const cached = swarm ? await swarm.getCachedWasm(url) : null;
      if (cached) {
        recordJournal({
          source: "cache",
          status: 200,
          contentLength: cached.byteLength,
          contentType: WASM_CONTENT_TYPE,
          kindGuess: "wasm",
        });
        return bufferToResponse(cached);
      }

      if (quietMode) {
        recordQuietModeP2PSkipped();
      }

      const p2pResponse = await attemptWasmP2P(graceMs);
      if (p2pResponse) return p2pResponse;

      if (canRampup) {
        const rampup = await enterRampupGate({ code, url, enabled: true });
        if (rampup?.slot === "wait" && rampup.waitMs > 0) {
          setNetworkPrepStatus("waiting", { reason: "rampup_wait", ttlMs: rampup.waitMs });
          if (p2pEnabled && swarm) {
            const rampupP2P = await attemptWasmP2P(rampup.waitMs);
            if (rampupP2P) {
              clearNetworkPrepStatus();
              await rampup.leave();
              return rampupP2P;
            }
          } else {
            await sleep(rampup.waitMs);
          }
          clearNetworkPrepStatus();
        }
        if (rampup) {
          void rampup.leave();
        }
      }

      markLeaseRelevantFetch();
      const leaseOk = await ensureLease(code, LEASE_MAX_WAIT_MS, {
        onWait: () => recordWasmLeaseWait(),
        onBypass: () => recordWasmLeaseBypass(),
      });
      void maybeRenewLease(code);
      if (!leaseOk) {
        recordWasmErrorCode("lease_bypass");
      }

      try {
        const response = await fetchWithTimeout(input, init);
        if (!response.ok) {
          recordNetworkSaverError("WASM_ORIGIN", `HTTP ${response.status}`);
          recordJournal({ source: "origin", status: response.status, kindGuess: "wasm" });
          throw new Error(`HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (!isWasmMagic(buffer)) {
          recordWasmErrorCode("origin_invalid_wasm");
          recordJournal({ source: "origin", status: response.status, kindGuess: "wasm" });
          throw new Error("invalid_wasm");
        }
        recordWasmOriginFetch(buffer.byteLength);
        recordJournal({
          source: "origin",
          status: response.status,
          contentLength: buffer.byteLength,
          contentType: response.headers.get("content-type"),
          kindGuess: "wasm",
        });
        if (swarm) {
          await swarm.storeWasm(url, buffer);
          swarm.broadcastHave(url, buffer.byteLength, { kind: "wasm" });
        }
        return bufferToResponse(buffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : "origin_fetch_failed";
        recordWasmErrorCode(message);
        recordJournal({ source: "origin", status: 0, kindGuess: "wasm" });
        throw error;
      }
    }

    allowed.add(url);
    const cached = swarm ? await swarm.getCachedResource(url) : { buffer: null, meta: undefined };
    if (cached.buffer) {
      recordJournal({
        source: "cache",
        status: 200,
        contentLength: cached.buffer.byteLength,
        contentType: cached.meta?.contentType ?? inferContentType(url),
        kindGuess: cached.meta?.kind ?? undefined,
      });
      return bufferToResourceResponse(cached.buffer, cached.meta?.contentType ?? inferContentType(url));
    }

    if (quietMode) {
      recordQuietModeP2PSkipped();
    }

    const isBlocked = isP2PBlocked(code, url);
    setShardBlocklistCount(countP2PBlocklistEntries(code));
    let decisionKind: "meta" | "small_shard" | null = null;
    let headContentLength: number | null = null;
    let headContentType: string | null = null;

    if (p2pEnabled && swarm && !isBlocked && tierForRequest !== "wasm") {
      try {
        const headResponse = await fetchHeadWithTimeout(url, { headers });
        const sizeHeader = headResponse.headers.get("content-length");
        const contentLength = sizeHeader ? Number(sizeHeader) : null;
        const contentType = headResponse.headers.get("content-type") ?? inferContentType(url) ?? null;
        const decision = headResponse.ok
          ? shouldP2PResource(url, headers, headResponse.headers, tierForRequest)
          : { ok: false, reason: "head_failed" };

        const resolvedKind = decision.kind === "wasm" ? null : decision.kind;
        if (decision.ok && resolvedKind) {
          allowed.add(url);
          decisionKind = resolvedKind;
          headContentLength = contentLength;
          headContentType = contentType;
            const p2pResult = await attemptResourceP2P(resolvedKind, contentLength, contentType);
          if (p2pResult) {
            return p2pResult;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "p2p_head_failed";
        recordNetworkSaverError("META_HEAD", message);
        recordJournal({ source: "p2p", status: 0, kindGuess: "meta" });
      }
    }

    const rampupKind = getP2PResourceKindForUrl(url, tierForRequest);
    if (canRampup && rampupKind) {
      const rampup = await enterRampupGate({ code, url, enabled: true });
      if (rampup?.slot === "wait" && rampup.waitMs > 0) {
        setNetworkPrepStatus("waiting", { reason: "rampup_wait", ttlMs: rampup.waitMs });
        if (decisionKind && decisionKind === rampupKind && p2pEnabled && swarm) {
          const rampupP2P = await attemptResourceP2P(
            decisionKind,
            headContentLength,
            headContentType,
          );
          if (rampupP2P) {
            clearNetworkPrepStatus();
            await rampup.leave();
            return rampupP2P;
          }
        } else {
          await sleep(rampup.waitMs);
        }
        clearNetworkPrepStatus();
      }
      if (rampup) {
        void rampup.leave();
      }
    }

    markLeaseRelevantFetch();
    await ensureLease(code, RESOURCE_LEASE_MAX_WAIT_MS);
    void maybeRenewLease(code);

    try {
      const response = await fetchWithTimeout(input, init);
      if (!response.ok) {
        recordNetworkSaverError("META_ORIGIN", `HTTP ${response.status}`);
        recordJournal({ source: "origin", status: response.status });
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      recordOriginFetch();
      const decision = shouldP2PResource(url, headers, response.headers, tierForRequest);
      if (decision.kind === "small_shard") {
        recordShardOriginFetch(buffer.byteLength);
      } else if (decision.kind === "meta") {
        recordMetaOriginFetch(buffer.byteLength, url);
      }
      const contentType = response.headers.get("content-type") ?? inferContentType(url);
      const sizeHeader = response.headers.get("content-length");
      const contentLength = sizeHeader ? Number(sizeHeader) : null;
      const { MIN_BYTES, MAX_BYTES } = getP2PResourceLimits();
      const canStore =
        decision.ok &&
        contentLength &&
        Number.isFinite(contentLength) &&
        contentLength >= MIN_BYTES &&
        contentLength <= MAX_BYTES;
      recordJournal({
        source: "origin",
        status: response.status,
        contentLength: contentLength ?? buffer.byteLength,
        contentType: contentType,
        kindGuess: decision.kind === "small_shard" ? "small_shard" : "meta",
      });
      if (swarm && canStore) {
        const sha256 = await computeSha256(buffer);
        await swarm.storeResource(url, buffer, {
          size: buffer.byteLength,
          lastAccess: Date.now(),
          contentType: contentType ?? undefined,
          sha256: sha256 ?? undefined,
          kind: decision.kind === "small_shard" ? "small_shard" : "meta",
        });
        swarm.broadcastHave(url, buffer.byteLength, {
          kind: decision.kind === "small_shard" ? "small_shard" : "meta",
          contentType: contentType ?? undefined,
          sha256: sha256 ?? undefined,
        });
      }
      return bufferToResourceResponse(buffer, contentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : "origin_fetch_failed";
      recordNetworkSaverError("META_ORIGIN", message);
      recordJournal({ source: "origin", status: 0 });
      throw error;
    }
  };
};
