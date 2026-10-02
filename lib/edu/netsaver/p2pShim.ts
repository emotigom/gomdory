import { getP2PGraceMs } from "./config";
import { recordP2PHit, recordNetworkSaverError, setP2PConnectionCount } from "./metrics";

type P2PFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response | null>;

declare global {
  interface Window {
    __eduP2P?: {
      fetch?: P2PFetch;
      connectionCount?: number;
    };
  }
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export const installP2PShim = (graceMs = getP2PGraceMs()) => {
  if (typeof window === "undefined") return;
  const baseFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const p2pFetch = window.__eduP2P?.fetch;
    const connectionCount = window.__eduP2P?.connectionCount ?? 0;
    setP2PConnectionCount(connectionCount);

    if (!p2pFetch) {
      return baseFetch(input, init);
    }

    try {
      const p2pResponse = await withTimeout(p2pFetch(input, init), graceMs);
      if (p2pResponse) {
        recordP2PHit();
        return p2pResponse;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "p2p_fetch_failed";
      recordNetworkSaverError("P2P_FETCH", message);
    }

    return baseFetch(input, init);
  };
};
