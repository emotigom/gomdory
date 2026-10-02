import { getWebllmPaths } from "../llm/webllmConfig";
import type { NetworkSaverTier } from "./config";
import { recordOriginFetch } from "./metrics";
import {
  clearLeaseState,
  ensureLease,
  markLeaseRelevantFetch,
  maybeRenewLease,
  releaseActiveLease,
} from "./leaseManager";
import { getWasmAllowlist } from "./wasmAllowlist";
import { recordResourceJournalEntry } from "./resourceJournal";
import { enterRampupGate, hasAppliedRampupWait } from "./rampupClient";
import { getP2PResourceKindForUrl } from "./shouldP2PResource";
import { clearNetworkPrepStatus, setNetworkPrepStatus } from "./status";
import { syncQuietModeFromBoost } from "./boostWindow";

let originalFetch: typeof fetch | null = null;

const DEFAULT_MAX_WAIT_MS = 6_000;

const ensureOriginalFetch = () => {
  if (!originalFetch) {
    originalFetch = window.fetch.bind(window);
  }
  return originalFetch;
};

const resolveRelevantBases = () => {
  try {
    const paths = getWebllmPaths();
    return [paths.modelBase, paths.libBase];
  } catch {
    return [] as string[];
  }
};

const isRelevantUrl = (url: string, bases: string[]) => {
  const wasmAllowlist = getWasmAllowlist();
  if (wasmAllowlist.has(url)) return false;
  return bases.some((base) => url.startsWith(base));
};

const getUrlString = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const installModelResourceFetchShim = (
  code: string,
  options: { tier: NetworkSaverTier; rampupEnabled: boolean; quietMode?: boolean },
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
) => {
  if (typeof window === "undefined") return;
  const baseFetch = ensureOriginalFetch();
  const relevantBases = resolveRelevantBases();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getUrlString(input);
    let resolvedUrl = url;
    try {
      resolvedUrl = new URL(url, window.location.href).href;
    } catch {
      resolvedUrl = url;
    }

    if (!isRelevantUrl(resolvedUrl, relevantBases)) {
      return baseFetch(input, init);
    }

    const quietFromBoost = syncQuietModeFromBoost(code);
    const quietMode = (options.quietMode ?? false) || quietFromBoost.enabled;

    markLeaseRelevantFetch();

    const rampupKind = getP2PResourceKindForUrl(resolvedUrl, options.tier);
    const shouldRampup =
      options.rampupEnabled &&
      !quietMode &&
      rampupKind !== null &&
      !hasAppliedRampupWait(code, resolvedUrl);
    const rampup = shouldRampup ? await enterRampupGate({ code, url: resolvedUrl, enabled: true }) : null;
    if (rampup?.slot === "wait" && rampup.waitMs > 0) {
      setNetworkPrepStatus("waiting", { reason: "rampup_wait", ttlMs: rampup.waitMs });
      await sleep(rampup.waitMs);
      clearNetworkPrepStatus();
    }
    if (rampup) {
      void rampup.leave();
    }

    await ensureLease(code, maxWaitMs);
    void maybeRenewLease(code);

    recordOriginFetch();
    const requestStartedAt = performance.now();
    const headers = mergeHeaders(input, init);
    const isRange = headers.has("range");
    try {
      const response = await baseFetch(input, init);
      void recordResourceJournalEntry({
        code,
        url: resolvedUrl,
        source: "origin",
        status: response.status,
        contentLength: Number(response.headers.get("content-length")) || null,
        contentType: response.headers.get("content-type"),
        durationMs: Math.round(performance.now() - requestStartedAt),
        rangeRequested: isRange,
      });
      return response;
    } catch (error) {
      void recordResourceJournalEntry({
        code,
        url: resolvedUrl,
        source: "origin",
        status: 0,
        durationMs: Math.round(performance.now() - requestStartedAt),
        rangeRequested: isRange,
      });
      throw error;
    }
  };
};

export const clearModelResourceFetchShim = () => {
  if (originalFetch) {
    window.fetch = originalFetch;
  }
  clearLeaseState();
};

export { releaseActiveLease };
