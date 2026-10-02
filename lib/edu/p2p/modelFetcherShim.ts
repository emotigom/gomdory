import { assembleResponse, getChunkMeta, markComplete, putChunk, setChunkMeta } from "./chunkStore";
import { getP2PDiagnostics, incrementP2PCount, setOriginLeaseActive } from "./p2pState";
import type { PeerSwarm } from "./peerSwarm";
import { delay, withTimeout } from "./utils";

type Role = "teacher" | "student";

type FetchShimOptions = {
  roomKey: string;
  peerId: string;
  role: Role;
  swarm: PeerSwarm;
};

const CHUNK_SIZE = 512 * 1024;
const PEER_GRACE_MS = 300;
const PEER_CHUNK_TIMEOUT_MS = 1800;
const LEASE_WAIT_TIMEOUT_MS = 12_000;
const MAX_ORIGIN_STREAMS = 2;

let installed = false;

class Semaphore {
  private readonly max: number;
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  async acquire() {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

const originSemaphore = new Semaphore(MAX_ORIGIN_STREAMS);

function shouldIntercept(url: URL) {
  return url.hostname === "models.gomdory.com" || url.pathname.includes("/libs/");
}

async function acquireLease(roomKey: string, peerId: string) {
  const url = new URL("/__edu_p2p/lease", window.location.origin);
  url.searchParams.set("code", roomKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomKey, peerId, want: "download" }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { retryAfterMs?: number } | null;
    return { ok: false as const, retryAfterMs: payload?.retryAfterMs ?? 500 };
  }
  const payload = (await response.json()) as { leaseId: string; ttlMs: number };
  return { ok: true as const, leaseId: payload.leaseId, ttlMs: payload.ttlMs };
}

async function releaseLease(roomKey: string, peerId: string, leaseId: string) {
  const url = new URL("/__edu_p2p/lease/release", window.location.origin);
  url.searchParams.set("code", roomKey);
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomKey, peerId, leaseId }),
  });
}

async function fetchFromPeer(url: string, swarm: PeerSwarm) {
  const peer = swarm.hasCompletePeer(url);
  if (!peer) return null;

  const { peerId, meta } = peer;
  const totalChunks = Math.ceil(meta.totalSize / meta.chunkSize);
  if (!Number.isFinite(totalChunks) || totalChunks <= 0) return null;

  const firstChunk = await withTimeout(
    swarm.requestChunkFromPeer(peerId, url, 0, PEER_CHUNK_TIMEOUT_MS),
    PEER_GRACE_MS,
    "peer_grace_timeout",
  ).catch(() => null);

  if (!firstChunk) return null;

  await setChunkMeta({
    url,
    chunkSize: meta.chunkSize,
    totalSize: meta.totalSize,
    contentType: meta.contentType,
    complete: false,
  });
  await putChunk(url, 0, firstChunk);

  let nextIndex = 1;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (nextIndex === 1) {
        controller.enqueue(new Uint8Array(firstChunk));
      }
      if (nextIndex >= totalChunks) {
        await markComplete(url);
        controller.close();
        return;
      }
      try {
        const chunk = await swarm.requestChunkFromPeer(peerId, url, nextIndex, PEER_CHUNK_TIMEOUT_MS);
        await putChunk(url, nextIndex, chunk);
        controller.enqueue(new Uint8Array(chunk));
        nextIndex += 1;
        if (nextIndex >= totalChunks) {
          await markComplete(url);
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });

  incrementP2PCount("p2pHitCount");
  return new Response(stream, {
    headers: {
      "content-type": meta.contentType ?? "application/octet-stream",
    },
  });
}

async function storeOriginResponse(url: string, response: Response, swarm: PeerSwarm) {
  const contentLength = response.headers.get("content-length");
  const contentType = response.headers.get("content-type");
  const totalSize = contentLength ? Number.parseInt(contentLength, 10) : NaN;
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return;
  }
  await setChunkMeta({
    url,
    chunkSize: CHUNK_SIZE,
    totalSize,
    contentType,
    complete: false,
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  let pending = new Uint8Array(0);
  let chunkIndex = 0;

  const append = (a: Uint8Array, b: Uint8Array) => {
    const combined = new Uint8Array(a.byteLength + b.byteLength);
    combined.set(a, 0);
    combined.set(b, a.byteLength);
    return combined;
  };

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    pending = append(pending, result.value);
    while (pending.byteLength >= CHUNK_SIZE) {
      const slice = pending.slice(0, CHUNK_SIZE);
      pending = pending.slice(CHUNK_SIZE);
      await putChunk(url, chunkIndex, slice.buffer);
      await swarm.announceChunk(url, chunkIndex, {
        totalSize,
        chunkSize: CHUNK_SIZE,
        contentType,
      });
      chunkIndex += 1;
    }
  }

  if (pending.byteLength > 0) {
    await putChunk(url, chunkIndex, pending.buffer);
    await swarm.announceChunk(url, chunkIndex, {
      totalSize,
      chunkSize: CHUNK_SIZE,
      contentType,
    });
  }

  await markComplete(url);
  await swarm.announceComplete(url, {
    totalSize,
    chunkSize: CHUNK_SIZE,
    contentType,
  });
}

async function fetchWithLease(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  url: string,
  roomKey: string,
  peerId: string,
  swarm: PeerSwarm,
) {
  const started = Date.now();
  let leaseId: string | null = null;
  while (Date.now() - started < LEASE_WAIT_TIMEOUT_MS) {
    const lease = await acquireLease(roomKey, peerId);
    if (lease.ok) {
      leaseId = lease.leaseId;
      setOriginLeaseActive(true);
      break;
    }
    incrementP2PCount("leaseWaitCount");
    await delay(lease.retryAfterMs);
  }

  incrementP2PCount("originFetchCount");
  const response = await fetcher(input, init);
  if (!response.ok) {
    if (leaseId) {
      void releaseLease(roomKey, peerId, leaseId);
      setOriginLeaseActive(false);
    }
    return response;
  }

  await originSemaphore.acquire();
  const clone = response.clone();
  void storeOriginResponse(url, clone, swarm)
    .catch(() => {
      // ignore storage errors
    })
    .finally(async () => {
      originSemaphore.release();
      if (leaseId) {
        await releaseLease(roomKey, peerId, leaseId);
        setOriginLeaseActive(false);
      }
    });

  return response;
}

export function installEduModelFetchShim(options: FetchShimOptions) {
  if (installed) return;
  installed = true;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method =
      (typeof input !== "string" && "method" in input ? input.method : init?.method) ?? "GET";
    if (method !== "GET") {
      return originalFetch(input, init);
    }
    const url = new URL(
      typeof input === "string" ? input : "url" in input ? input.url : input.toString(),
      window.location.origin,
    );

    if (!shouldIntercept(url)) {
      return originalFetch(input, init);
    }

    const cachedMeta = await getChunkMeta(url.toString());
    if (cachedMeta?.complete) {
      const cached = await assembleResponse(url.toString(), cachedMeta);
      if (cached) {
        incrementP2PCount("p2pHitCount");
        return cached;
      }
    }

    if (getP2PDiagnostics().status !== "disabled") {
      const peerResponse = await fetchFromPeer(url.toString(), options.swarm);
      if (peerResponse) {
        return peerResponse;
      }
    }

    return fetchWithLease(
      originalFetch,
      input,
      init,
      url.toString(),
      options.roomKey,
      options.peerId,
      options.swarm,
    );
  };
}
