import SimplePeer from "simple-peer";
import type { Instance, SignalData, SimplePeerData } from "simple-peer";

import {
  getNetworkSaverMetricsSnapshot,
  recordEpidemicBytesSent,
  recordEpidemicOfferAccepted,
  recordEpidemicOfferSent,
  recordEpidemicWantServed,
  recordSeedLiteBytesSent,
  recordSeedLiteWantServed,
  setEpidemicEnabled,
  setEpidemicSeedEligible,
  setP2PConnectionCount,
  setSeedLiteEnabled,
  setSeedLiteStopReason,
} from "./metrics";
import {
  recordAutoDowngradePeerConnected,
  recordAutoDowngradePeerDisconnected,
} from "./autoDowngrade";
import { getP2PMaxBytes } from "./config";
import { hashRoomCodeShort } from "./hash";
import {
  recordEpidemicDisconnect,
  recordEpidemicSendFailure,
  recordEpidemicSendSuccess,
  refreshEpidemicDisabledUntil,
} from "./epidemicControl";
import { evaluateSeedEligibility } from "./seedPolicy";
import { saveDegradedNetworkSaverConfig } from "./recommendationConfig";

type SwarmRole = "teacher" | "student";

type SwarmStatus = "idle" | "connecting" | "ready" | "failed";

type SwarmMessage =
  | {
      t: "have";
      url: string;
      size: number;
      kind?: "wasm" | "meta" | "small_shard";
      contentType?: string;
      sha256?: string;
    }
  | { t: "want"; url: string; probe?: boolean }
  | { t: "offer"; url: string; from: string; score: number }
  | { t: "accept"; url: string; to: string }
  | { t: "cancel"; url: string; to: string }
  | {
      t: "meta";
      url: string;
      size: number;
      chunkSize: number;
      kind: "wasm" | "meta" | "small_shard";
      contentType?: string;
      sha256?: string;
    }
  | { t: "done"; url: string }
  | { t: "err"; url: string; code: string };

type SignalingMessage =
  | { type: "join"; peerId: string; role: SwarmRole }
  | { type: "leave"; peerId: string }
  | { type: "signal"; from: string; to: string; data: SignalData };

type IncomingTransfer = {
  url: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  chunks: Array<Uint8Array | null>;
  receivedCount: number;
  kind: "wasm" | "meta" | "small_shard";
  contentType?: string;
  sha256?: string;
};

type PendingReceive = {
  resolve: (result: { buffer: ArrayBuffer; meta: IncomingTransfer }) => void;
  reject: (reason: string) => void;
  timeoutId: number;
  acceptedPeerId?: string;
  offerTimerId?: number;
  offers?: Map<string, { from: string; score: number }>;
};

type WasmSwarmOptions = {
  roomCode: string;
  role: SwarmRole;
  maxPeers: number;
  allowlist: Set<string>;
  handshakeTimeoutMs?: number;
  chunkSize?: number;
  teacherUploadLimitBps?: number;
  studentUploadLimitBps?: number;
};

type PeerState = {
  id: string;
  peer: Instance;
  incoming?: IncomingTransfer;
  handshakeTimer?: number;
  connectedAt?: number | null;
};

const MAGIC = 0x5741534d;
const DEFAULT_CHUNK_SIZE = 256 * 1024;
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 2_500;
const MAX_RESOURCE_CACHE_BYTES = 80 * 1024 * 1024;
const MAX_SMALL_SHARD_CACHE_COUNT = 3;
const RESOURCE_INDEX_KEY = "edu:netsaver:resource-index";
const SEEDLITE_DISCONNECT_WINDOW_MS = 5 * 60 * 1000;
const SEEDLITE_DISCONNECT_MAX = 3;
const SEEDLITE_MAX_BYTES = getP2PMaxBytes();
const SEEDLITE_SEND_TIMEOUT_MS = 8_000;
const OFFER_WINDOW_MS = 150;
const EPIDEMIC_MAX_BYTES = 20 * 1024 * 1024;
const EPIDEMIC_MAX_DURATION_MS = 120_000;
const EPIDEMIC_OFFER_TTL_MS = 2_000;

const createDb = () => {
  if (typeof indexedDB === "undefined") return null;
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("edu-wasm-cache", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("wasm")) {
        db.createObjectStore("wasm");
      }
      if (!db.objectStoreNames.contains("resource")) {
        db.createObjectStore("resource");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getFromDb = async (storeName: "wasm" | "resource", key: string) => {
  try {
    const db = await createDb();
    if (!db) return null;
    return await new Promise<ArrayBuffer | null>((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const setInDb = async (storeName: "wasm" | "resource", key: string, value: ArrayBuffer) => {
  try {
    const db = await createDb();
    if (!db) return false;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch {
    return false;
  }
};

const deleteFromDb = async (storeName: "wasm" | "resource", key: string) => {
  try {
    const db = await createDb();
    if (!db) return false;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const toAbsoluteUrl = (url: string) => {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

type ResourceIndexEntry = {
  size: number;
  lastAccess: number;
  contentType?: string;
  sha256?: string;
  kind?: "meta" | "small_shard";
};

type ResourceIndexState = {
  totalBytes: number;
  entries: Map<string, ResourceIndexEntry>;
};

let resourceIndexState: ResourceIndexState | null = null;

const loadResourceIndex = () => {
  if (resourceIndexState) return resourceIndexState;
  const fallback: ResourceIndexState = { totalBytes: 0, entries: new Map() };
  if (typeof window === "undefined") {
    resourceIndexState = fallback;
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(RESOURCE_INDEX_KEY);
    if (!raw) {
      resourceIndexState = fallback;
      return fallback;
    }
    const parsed = JSON.parse(raw) as {
      totalBytes?: number;
      entries?: Record<string, ResourceIndexEntry>;
    };
    const entries = new Map<string, ResourceIndexEntry>();
    if (parsed.entries) {
      for (const [url, entry] of Object.entries(parsed.entries)) {
        if (!entry || typeof entry.size !== "number" || typeof entry.lastAccess !== "number") {
          continue;
        }
        const kind = entry.kind === "small_shard" ? "small_shard" : "meta";
        entries.set(url, { ...entry, kind });
      }
    }
    resourceIndexState = {
      totalBytes: parsed.totalBytes ?? 0,
      entries,
    };
    return resourceIndexState;
  } catch {
    resourceIndexState = fallback;
    return fallback;
  }
};

const persistResourceIndex = () => {
  if (typeof window === "undefined") return;
  const state = loadResourceIndex();
  const entries: Record<string, ResourceIndexEntry> = {};
  for (const [url, entry] of state.entries) {
    entries[url] = entry;
  }
  try {
    window.localStorage.setItem(
      RESOURCE_INDEX_KEY,
      JSON.stringify({ totalBytes: state.totalBytes, entries }),
    );
  } catch {
    // ignore storage failures
  }
};

const readHeader = (data: Uint8Array) => {
  if (data.byteLength < 12) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, false);
  if (magic !== MAGIC) return null;
  return {
    chunkIndex: view.getUint32(4, false),
    totalChunks: view.getUint32(8, false),
  };
};

const buildChunkFrame = (index: number, total: number, payload: ArrayBuffer) => {
  const header = new ArrayBuffer(12);
  const view = new DataView(header);
  view.setUint32(0, MAGIC, false);
  view.setUint32(4, index, false);
  view.setUint32(8, total, false);
  const payloadView = new Uint8Array(payload);
  const frame = new Uint8Array(12 + payloadView.byteLength);
  frame.set(new Uint8Array(header), 0);
  frame.set(payloadView, 12);
  return frame;
};

const isWasmMagic = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 4) return false;
  const magic = new Uint8Array(buffer.slice(0, 4));
  return magic[0] === 0x00 && magic[1] === 0x61 && magic[2] === 0x73 && magic[3] === 0x6d;
};

const getBufferedAmount = (peer: Instance) => {
  const channel = (peer as Instance & { _channel?: RTCDataChannel })._channel;
  return channel?.bufferedAmount ?? 0;
};

const waitForBackpressure = async (peer: Instance, timeoutMs?: number) => {
  const startedAt = Date.now();
  while (getBufferedAmount(peer) > 512 * 1024) {
    if (timeoutMs && Date.now() - startedAt > timeoutMs) {
      return false;
    }
    await sleep(10);
  }
  await Promise.resolve();
  return true;
};

export class WasmSwarm {
  private readonly roomCode: string;
  private readonly role: SwarmRole;
  private readonly maxPeers: number;
  private readonly allowlist: Set<string>;
  private readonly chunkSize: number;
  private readonly handshakeTimeoutMs: number;
  private readonly teacherUploadLimitBps: number;
  private readonly studentUploadLimitBps: number;
  private readonly peerId: string;
  private status: SwarmStatus = "idle";
  private ws: WebSocket | null = null;
  private peers = new Map<string, PeerState>();
  private haveByUrl = new Map<string, Set<string>>();
  private haveWaiters = new Map<
    string,
    { resolve: (peerId: string) => void; timeoutId: number }
  >();
  private pendingReceives = new Map<string, PendingReceive>();
  private cache = new Map<string, ArrayBuffer>();
  private resourceCache = new Map<string, ArrayBuffer>();
  private resourceMeta = new Map<string, ResourceIndexEntry>();
  private sendQueue: Promise<void> = Promise.resolve();
  private smallShardSendQueue: Promise<void> = Promise.resolve();
  private seedLiteEnabled = false;
  private seedLiteBytesSentTotal = 0;
  private seedLiteDisconnectTimestamps: number[] = [];
  private seedLiteTimeoutMsTotal = 0;
  private activeServePeers = new Set<string>();
  private recentDisconnectTimestamps: number[] = [];
  private seedSessionStartedAt: number | null = null;
  private seedSessionBytesSent = 0;
  private codeHash: string | null = null;
  private codeHashPromise: Promise<void> | null = null;
  private outgoingOffers = new Map<string, number>();

  constructor(options: WasmSwarmOptions) {
    this.roomCode = options.roomCode;
    this.role = options.role;
    this.maxPeers = options.maxPeers;
    this.allowlist = options.allowlist;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    this.teacherUploadLimitBps = options.teacherUploadLimitBps ?? 200 * 1024;
    this.studentUploadLimitBps = options.studentUploadLimitBps ?? 300 * 1024;
    this.peerId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }

  getStatus() {
    return this.status;
  }

  getConnectionCount() {
    return this.peers.size;
  }

  getRole() {
    return this.role;
  }

  isSeedLiteEnabled() {
    return this.seedLiteEnabled;
  }

  enableSeedLite() {
    if (this.role !== "teacher") return;
    if (this.seedLiteEnabled) return;
    this.seedLiteEnabled = true;
    this.seedLiteBytesSentTotal = 0;
    this.seedLiteDisconnectTimestamps = [];
    this.seedLiteTimeoutMsTotal = 0;
    setSeedLiteEnabled(true);
    setSeedLiteStopReason(null);
  }

  stopSeedLite(reason: string, options?: { disconnectPeers?: boolean; downgrade?: boolean }) {
    if (this.seedLiteEnabled) {
      this.seedLiteEnabled = false;
      setSeedLiteEnabled(false);
    }
    setSeedLiteStopReason(reason);
    if (options?.disconnectPeers ?? true) {
      this.stop();
    }
    if (options?.downgrade ?? false) {
      void saveDegradedNetworkSaverConfig(this.roomCode);
    }
  }

  async registerHave(
    url: string,
    buffer: ArrayBuffer,
    meta?: { kind?: "wasm" | "meta" | "small_shard"; contentType?: string; sha256?: string },
  ) {
    if (meta?.kind === "wasm") {
      await this.storeWasm(url, buffer);
      return;
    }
    const kind = meta?.kind ?? "meta";
    await this.storeResource(url, buffer, {
      size: buffer.byteLength,
      lastAccess: Date.now(),
      contentType: meta?.contentType,
      sha256: meta?.sha256,
      kind,
    });
  }

  async start() {
    if (this.status !== "idle") return;
    this.status = "connecting";
    void this.ensureCodeHash();
    const ws = new WebSocket(
      `/__edu_p2p/ws?code=${encodeURIComponent(this.roomCode)}&roomKey=${encodeURIComponent(
        this.roomCode,
      )}`,
    );
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", peerId: this.peerId, role: this.role }));
    };
    ws.onmessage = (event) => this.handleSignalMessage(event.data as string);
    ws.onerror = () => {
      this.status = "failed";
    };
    ws.onclose = () => {
      this.status = "failed";
    };
  }

  stop() {
    this.ws?.close();
    this.ws = null;
    for (const [, state] of this.peers) {
      state.peer.destroy();
      if (state.handshakeTimer) window.clearTimeout(state.handshakeTimer);
    }
    this.peers.clear();
    this.status = "idle";
    if (this.seedLiteEnabled) {
      this.seedLiteEnabled = false;
      setSeedLiteEnabled(false);
    }
    setP2PConnectionCount(0);
  }

  private async ensureCodeHash() {
    if (this.codeHash || this.codeHashPromise) return;
    this.codeHashPromise = hashRoomCodeShort(this.roomCode, 8)
      .then((hash) => {
        if (hash && hash !== "-") {
          this.codeHash = hash;
        } else {
          this.codeHash = null;
        }
        refreshEpidemicDisabledUntil(this.codeHash);
      })
      .finally(() => {
        this.codeHashPromise = null;
      });
  }

  async getCachedWasm(url: string) {
    const normalized = toAbsoluteUrl(url);
    if (this.cache.has(normalized)) return this.cache.get(normalized) ?? null;
    if (!this.allowlist.has(normalized)) return null;
    const stored = await getFromDb("wasm", normalized);
    if (stored) {
      this.cache.set(normalized, stored);
    }
    return stored;
  }

  async storeWasm(url: string, buffer: ArrayBuffer) {
    const normalized = toAbsoluteUrl(url);
    if (!this.allowlist.has(normalized)) return;
    this.cache.set(normalized, buffer);
    await setInDb("wasm", normalized, buffer);
  }

  async getCachedResource(url: string) {
    const normalized = toAbsoluteUrl(url);
    if (this.resourceCache.has(normalized)) {
      const meta = this.resourceMeta.get(normalized);
      if (meta) this.touchResourceIndex(normalized, meta);
      return { buffer: this.resourceCache.get(normalized) ?? null, meta };
    }
    if (!this.allowlist.has(normalized)) return { buffer: null, meta: undefined };
    const stored = await getFromDb("resource", normalized);
    if (stored) {
      this.resourceCache.set(normalized, stored);
      const meta = loadResourceIndex().entries.get(normalized);
      if (meta) {
        this.resourceMeta.set(normalized, meta);
        this.touchResourceIndex(normalized, meta);
      }
      return { buffer: stored, meta };
    }
    return { buffer: null, meta: undefined };
  }

  async storeResource(url: string, buffer: ArrayBuffer, meta?: ResourceIndexEntry) {
    const normalized = toAbsoluteUrl(url);
    if (!this.allowlist.has(normalized)) return;
    this.resourceCache.set(normalized, buffer);
    if (meta) {
      this.resourceMeta.set(normalized, meta);
    }
    await setInDb("resource", normalized, buffer);
    this.touchResourceIndex(normalized, {
      size: buffer.byteLength,
      lastAccess: Date.now(),
      contentType: meta?.contentType,
      sha256: meta?.sha256,
      kind: meta?.kind,
    });
    await this.enforceResourceCacheLimit();
  }

  broadcastHave(
    url: string,
    size: number,
    meta?: { kind?: "wasm" | "meta" | "small_shard"; contentType?: string; sha256?: string },
  ) {
    const normalized = toAbsoluteUrl(url);
    if (!this.allowlist.has(normalized)) return;
    const message: SwarmMessage = {
      t: "have",
      url: normalized,
      size,
      kind: meta?.kind,
      contentType: meta?.contentType,
      sha256: meta?.sha256,
    };
    this.broadcast(message);
  }

  broadcastWant(url: string) {
    const normalized = toAbsoluteUrl(url);
    if (!this.allowlist.has(normalized)) return;
    const message: SwarmMessage = { t: "want", url: normalized, probe: true };
    this.broadcast(message);
  }

  waitForHave(url: string, timeoutMs: number) {
    const normalized = toAbsoluteUrl(url);
    const existing = this.haveByUrl.get(normalized);
    if (existing && existing.size > 0) {
      return Promise.resolve(existing.values().next().value as string);
    }
    return new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.haveWaiters.delete(normalized);
        reject(new Error("have_timeout"));
      }, timeoutMs);
      this.haveWaiters.set(normalized, { resolve, timeoutId });
    });
  }

  requestWasm(url: string, timeoutMs: number, options?: { offerWindowMs?: number }) {
    return this.requestResource(url, timeoutMs, options).then((result) => result.buffer);
  }

  requestResource(url: string, timeoutMs: number, options?: { offerWindowMs?: number }) {
    const normalized = toAbsoluteUrl(url);
    const existing = this.pendingReceives.get(normalized);
    if (existing) {
      return new Promise<{ buffer: ArrayBuffer; meta: IncomingTransfer }>((resolve, reject) => {
        existing.resolve = resolve;
        existing.reject = reject;
      });
    }
    if (this.peers.size === 0) return Promise.reject(new Error("peer_missing"));
    const timeoutId = window.setTimeout(() => {
      const pending = this.pendingReceives.get(normalized);
      if (pending) {
        this.pendingReceives.delete(normalized);
        pending.reject("receive_timeout");
      }
    }, timeoutMs);
    const pending: PendingReceive = {
      resolve: () => {},
      reject: () => {},
      timeoutId,
      offers: new Map(),
    };
    const promise = new Promise<{ buffer: ArrayBuffer; meta: IncomingTransfer }>((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    this.pendingReceives.set(normalized, pending);
    this.broadcast({ t: "want", url: normalized });
    const offerWindowMs = Math.max(50, options?.offerWindowMs ?? OFFER_WINDOW_MS);
    pending.offerTimerId = window.setTimeout(() => {
      this.selectOffer(normalized);
    }, offerWindowMs);
    return promise;
  }

  private broadcast(message: SwarmMessage) {
    const payload = JSON.stringify(message);
    for (const [, state] of this.peers) {
      if (state.peer.destroyed) continue;
      state.peer.send(payload);
    }
  }

  private handleSignalMessage(raw: string) {
    let message: SignalingMessage | null = null;
    try {
      message = JSON.parse(raw) as SignalingMessage;
    } catch {
      return;
    }
    if (!message) return;
    if (message.type === "join") {
      if (message.peerId === this.peerId) return;
      if (this.peers.size >= this.maxPeers) return;
      if (this.peers.has(message.peerId)) return;
      this.createPeer(message.peerId, this.peerId < message.peerId);
      return;
    }
    if (message.type === "leave") {
      this.removePeer(message.peerId);
      return;
    }
    if (message.type === "signal") {
      if (message.to !== this.peerId) return;
      this.acceptSignal(message.from, message.data);
    }
  }

  private createPeer(remoteId: string, initiator: boolean) {
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      config: { iceServers: [] },
    });
    const state: PeerState = { id: remoteId, peer, connectedAt: null };
    this.peers.set(remoteId, state);
    setP2PConnectionCount(this.peers.size);

    state.handshakeTimer = window.setTimeout(() => {
      if (!peer.connected) {
        this.removePeer(remoteId);
      }
    }, this.handshakeTimeoutMs);

    peer.on("signal", (data) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const payload: SignalingMessage = {
        type: "signal",
        from: this.peerId,
        to: remoteId,
        data,
      };
      this.ws.send(JSON.stringify(payload));
    });

    peer.on("connect", () => {
      if (state.handshakeTimer) {
        window.clearTimeout(state.handshakeTimer);
        state.handshakeTimer = undefined;
      }
      this.status = "ready";
      state.connectedAt = Date.now();
      recordAutoDowngradePeerConnected(this.roomCode);
      setP2PConnectionCount(this.peers.size);
      for (const [url, buffer] of this.cache) {
        this.sendMessage(peer, { t: "have", url, size: buffer.byteLength, kind: "wasm" });
      }
      for (const [url, buffer] of this.resourceCache) {
        const meta = this.resourceMeta.get(url);
        this.sendMessage(peer, {
          t: "have",
          url,
          size: buffer.byteLength,
          kind: meta?.kind ?? "meta",
          contentType: meta?.contentType,
          sha256: meta?.sha256,
        });
      }
    });

    peer.on("data", (data) => {
      this.handlePeerData(remoteId, data);
    });

    peer.on("close", () => {
      this.removePeer(remoteId);
    });

    peer.on("error", () => {
      this.removePeer(remoteId);
    });
  }

  private acceptSignal(remoteId: string, data: SignalData) {
    if (this.peers.size >= this.maxPeers && !this.peers.has(remoteId)) {
      return;
    }
    if (!this.peers.has(remoteId)) {
      this.createPeer(remoteId, false);
    }
    const state = this.peers.get(remoteId);
    if (!state) return;
    state.peer.signal(data);
  }

  private recordSeedLiteDisconnect() {
    if (!this.seedLiteEnabled) return;
    const now = Date.now();
    this.seedLiteDisconnectTimestamps = this.seedLiteDisconnectTimestamps.filter(
      (timestamp) => now - timestamp <= SEEDLITE_DISCONNECT_WINDOW_MS,
    );
    this.seedLiteDisconnectTimestamps.push(now);
    this.evaluateSeedLiteOverheat("disconnect_repeated");
  }

  private recordEpidemicDisconnectEvent() {
    const now = Date.now();
    this.recentDisconnectTimestamps = this.recentDisconnectTimestamps.filter(
      (timestamp) => now - timestamp <= 2 * 60 * 1000,
    );
    this.recentDisconnectTimestamps.push(now);
    if (this.role === "student") {
      recordEpidemicDisconnect(this.codeHash);
    }
  }

  private recordSeedLiteTimeout(timeoutMs: number) {
    if (!this.seedLiteEnabled) return;
    this.seedLiteTimeoutMsTotal += Math.max(0, timeoutMs);
    if (this.seedLiteTimeoutMsTotal >= SEEDLITE_SEND_TIMEOUT_MS) {
      this.stopSeedLite("send_timeout", { disconnectPeers: true, downgrade: true });
    }
  }

  private evaluateSeedLiteOverheat(reason: string) {
    if (!this.seedLiteEnabled) return;
    const disconnects = this.seedLiteDisconnectTimestamps.length;
    if (disconnects >= SEEDLITE_DISCONNECT_MAX) {
      this.stopSeedLite(reason, { disconnectPeers: true, downgrade: true });
      return;
    }
    if (
      this.seedLiteBytesSentTotal >= SEEDLITE_MAX_BYTES &&
      disconnects >= SEEDLITE_DISCONNECT_MAX - 1
    ) {
      this.stopSeedLite("bytes_over_limit", { disconnectPeers: true, downgrade: true });
    }
  }

  private removePeer(remoteId: string) {
    const state = this.peers.get(remoteId);
    if (!state) return;
    if (state.connectedAt) {
      const connectedForMs = Date.now() - state.connectedAt;
      void recordAutoDowngradePeerDisconnected(this.roomCode, connectedForMs);
    }
    state.peer.destroy();
    if (state.handshakeTimer) {
      window.clearTimeout(state.handshakeTimer);
    }
    this.peers.delete(remoteId);
    this.recordSeedLiteDisconnect();
    this.recordEpidemicDisconnectEvent();
    setP2PConnectionCount(this.peers.size);
  }

  private async handlePeerData(peerId: string, data: SimplePeerData) {
    const state = this.peers.get(peerId);
    if (!state) return;
    if (typeof data === "string") {
      this.handleControlMessage(state, data);
      return;
    }
    const buffer =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data instanceof Uint8Array
          ? data
          : new Uint8Array(data as ArrayBuffer);
    const header = readHeader(buffer);
    if (!header || !state.incoming) return;
    const payload = buffer.slice(12);
    if (header.totalChunks !== state.incoming.totalChunks) return;
    if (header.chunkIndex >= state.incoming.totalChunks) return;
    if (!state.incoming.chunks[header.chunkIndex]) {
      state.incoming.chunks[header.chunkIndex] = payload;
      state.incoming.receivedCount += 1;
    }
    if (state.incoming.receivedCount >= state.incoming.totalChunks) {
      const incoming = state.incoming;
      state.incoming = undefined;
      const complete = this.assembleIncoming(incoming);
      if (!complete) {
        this.rejectReceive(incoming.url, "assemble_failed");
        return;
      }
      this.resolveReceive(complete.url, complete.buffer, complete.meta);
    }
  }

  private handleControlMessage(state: PeerState, payload: string) {
    let message: SwarmMessage | null = null;
    try {
      message = JSON.parse(payload) as SwarmMessage;
    } catch {
      return;
    }
    if (!message) return;
    if (message.t === "have") {
      if (!this.allowlist.has(message.url)) return;
      const set = this.haveByUrl.get(message.url) ?? new Set<string>();
      set.add(state.id);
      this.haveByUrl.set(message.url, set);
      const waiter = this.haveWaiters.get(message.url);
      if (waiter) {
        window.clearTimeout(waiter.timeoutId);
        this.haveWaiters.delete(message.url);
        waiter.resolve(state.id);
      }
      return;
    }
    if (message.t === "want") {
      if (!this.allowlist.has(message.url)) return;
      if (message.probe) {
        const wasmBuffer = this.cache.get(message.url);
        if (wasmBuffer) {
          this.sendMessage(state.peer, {
            t: "have",
            url: message.url,
            size: wasmBuffer.byteLength,
            kind: "wasm",
          });
          return;
        }
        const resourceBuffer = this.resourceCache.get(message.url);
        if (resourceBuffer) {
          const meta = this.resourceMeta.get(message.url);
          this.sendMessage(state.peer, {
            t: "have",
            url: message.url,
            size: resourceBuffer.byteLength,
            kind: meta?.kind ?? "meta",
            contentType: meta?.contentType,
            sha256: meta?.sha256,
          });
        }
        return;
      }
      void this.handleWantRequest(state, message.url);
      return;
    }
    if (message.t === "offer") {
      this.handleOffer(state, message);
      return;
    }
    if (message.t === "accept") {
      this.handleAccept(state, message);
      return;
    }
    if (message.t === "cancel") {
      this.handleCancel(state, message);
      return;
    }
    if (message.t === "meta") {
      if (!this.allowlist.has(message.url)) return;
      const pending = this.pendingReceives.get(message.url);
      if (pending?.acceptedPeerId && pending.acceptedPeerId !== state.id) {
        return;
      }
      state.incoming = {
        url: message.url,
        size: message.size,
        chunkSize: message.chunkSize,
        totalChunks: Math.ceil(message.size / message.chunkSize),
        chunks: new Array(Math.ceil(message.size / message.chunkSize)).fill(null),
        receivedCount: 0,
        kind: message.kind,
        contentType: message.contentType,
        sha256: message.sha256,
      };
      return;
    }
    if (message.t === "done") {
      return;
    }
    if (message.t === "err") {
      this.rejectReceive(message.url, message.code);
    }
  }

  private getRecentDisconnects() {
    const now = Date.now();
    this.recentDisconnectTimestamps = this.recentDisconnectTimestamps.filter(
      (timestamp) => now - timestamp <= 2 * 60 * 1000,
    );
    return this.recentDisconnectTimestamps;
  }

  private resolveSeedEligibility() {
    if (this.role !== "student") {
      setEpidemicSeedEligible(false);
      setEpidemicEnabled(false);
      return { eligible: false };
    }
    const metrics = getNetworkSaverMetricsSnapshot();
    const recentDisconnects = this.getRecentDisconnects();
    const disabledUntil = refreshEpidemicDisabledUntil(this.codeHash);
    const result = evaluateSeedEligibility({
      mode: metrics.mode,
      p2pProbeStatus: metrics.p2pProbe.status,
      isTeacher: false,
      disconnectTimestamps: recentDisconnects,
    });
    const eligible = result.eligible && !disabledUntil;
    setEpidemicSeedEligible(result.eligible);
    setEpidemicEnabled(eligible);
    return { eligible, disabledUntil };
  }

  private canServeStudentSeed(kind: "wasm" | "meta" | "small_shard") {
    if (kind === "small_shard") return false;
    const status = this.resolveSeedEligibility();
    if (!status.eligible) return false;
    if (this.seedSessionBytesSent >= EPIDEMIC_MAX_BYTES) return false;
    if (
      this.seedSessionStartedAt &&
      Date.now() - this.seedSessionStartedAt > EPIDEMIC_MAX_DURATION_MS
    ) {
      return false;
    }
    return true;
  }

  private canOfferResource(kind: "wasm" | "meta" | "small_shard") {
    if (this.role === "student" && !this.canServeStudentSeed(kind)) return false;
    const maxServePeers = this.role === "student" ? 1 : Math.max(1, this.maxPeers);
    if (this.activeServePeers.size >= maxServePeers) return false;
    return true;
  }

  private handleWantRequest(state: PeerState, url: string) {
    const wasmBuffer = this.cache.get(url);
    if (wasmBuffer) {
      if (!this.canOfferResource("wasm")) return;
      this.sendOffer(state, url, "wasm");
      return;
    }
    const resourceBuffer = this.resourceCache.get(url);
    if (resourceBuffer) {
      const meta = this.resourceMeta.get(url);
      const kind = meta?.kind ?? "meta";
      if (kind === "small_shard" && this.role === "student") return;
      if (!this.canOfferResource(kind)) return;
      this.sendOffer(state, url, kind);
    }
  }

  private sendOffer(
    state: PeerState,
    url: string,
    kind: "wasm" | "meta" | "small_shard",
  ) {
    const stable = this.getRecentDisconnects().length <= 1;
    let score = this.role === "teacher" ? 100 : 50;
    score += 10;
    if (stable) score += 10;
    const offerKey = `${state.id}:${url}`;
    if (this.outgoingOffers.has(offerKey)) return;
    this.sendMessage(state.peer, { t: "offer", url, from: this.peerId, score });
    if (this.role === "student") {
      recordEpidemicOfferSent();
    }
    const timeoutId = window.setTimeout(() => {
      this.outgoingOffers.delete(offerKey);
    }, EPIDEMIC_OFFER_TTL_MS);
    this.outgoingOffers.set(offerKey, timeoutId);
    if (kind === "small_shard") {
      // noop: retain for scoring parity
    }
  }

  private handleOffer(
    state: PeerState,
    message: { t: "offer"; url: string; from: string; score: number },
  ) {
    const pending = this.pendingReceives.get(message.url);
    if (!pending || pending.acceptedPeerId) return;
    if (!pending.offers) pending.offers = new Map();
    pending.offers.set(state.id, { from: state.id, score: message.score });
  }

  private selectOffer(url: string) {
    const pending = this.pendingReceives.get(url);
    if (!pending) return;
    if (pending.offerTimerId) {
      window.clearTimeout(pending.offerTimerId);
      pending.offerTimerId = undefined;
    }
    const offers = pending.offers;
    if (!offers || offers.size === 0) {
      this.rejectReceive(url, "offer_timeout");
      return;
    }
    let chosen: { from: string; score: number } | null = null;
    for (const offer of offers.values()) {
      if (!this.peers.has(offer.from)) continue;
      if (!chosen || offer.score > chosen.score) {
        chosen = offer;
      }
    }
    if (!chosen) {
      this.rejectReceive(url, "offer_timeout");
      return;
    }
    pending.acceptedPeerId = chosen.from;
    const chosenPeer = this.peers.get(chosen.from);
    if (chosenPeer) {
      this.sendMessage(chosenPeer.peer, { t: "accept", url, to: chosen.from });
    }
    for (const offer of offers.values()) {
      if (offer.from === chosen.from) continue;
      const peer = this.peers.get(offer.from);
      if (peer) {
        this.sendMessage(peer.peer, { t: "cancel", url, to: offer.from });
      }
    }
  }

  private handleAccept(state: PeerState, message: { t: "accept"; url: string; to: string }) {
    if (message.to !== this.peerId) return;
    const offerKey = `${state.id}:${message.url}`;
    const timeoutId = this.outgoingOffers.get(offerKey);
    if (!timeoutId) return;
    window.clearTimeout(timeoutId);
    this.outgoingOffers.delete(offerKey);
    if (this.role === "student") {
      recordEpidemicOfferAccepted();
    }

    const wasmBuffer = this.cache.get(message.url);
    if (wasmBuffer) {
      if (!this.canOfferResource("wasm")) {
        this.sendMessage(state.peer, { t: "err", url: message.url, code: "seed_unavailable" });
        return;
      }
      void this.sendResource(state.id, state.peer, message.url, wasmBuffer, { kind: "wasm" });
      return;
    }
    const resourceBuffer = this.resourceCache.get(message.url);
    if (resourceBuffer) {
      const meta = this.resourceMeta.get(message.url);
      const kind = meta?.kind ?? "meta";
      if (!this.canOfferResource(kind)) {
        this.sendMessage(state.peer, { t: "err", url: message.url, code: "seed_unavailable" });
        return;
      }
      void this.sendResource(state.id, state.peer, message.url, resourceBuffer, {
        kind,
        contentType: meta?.contentType,
        sha256: meta?.sha256,
      });
      return;
    }
    this.sendMessage(state.peer, { t: "err", url: message.url, code: "resource_missing" });
  }

  private handleCancel(state: PeerState, message: { t: "cancel"; url: string; to: string }) {
    if (message.to !== this.peerId) return;
    const offerKey = `${state.id}:${message.url}`;
    const timeoutId = this.outgoingOffers.get(offerKey);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.outgoingOffers.delete(offerKey);
    }
  }

  private async sendResource(
    peerId: string,
    peer: Instance,
    url: string,
    buffer: ArrayBuffer,
    meta: { kind: "wasm" | "meta" | "small_shard"; contentType?: string; sha256?: string },
  ) {
    const isStudent = this.role === "student";
    if (isStudent) {
      const maxServePeers = 1;
      if (!this.activeServePeers.has(peerId) && this.activeServePeers.size >= maxServePeers) {
        this.sendMessage(peer, { t: "err", url, code: "serve_busy" });
        return;
      }
      this.activeServePeers.add(peerId);
      if (!this.seedSessionStartedAt) {
        this.seedSessionStartedAt = Date.now();
      }
    }
    const send = async () => {
      const totalChunks = Math.ceil(buffer.byteLength / this.chunkSize);
      this.sendMessage(peer, {
        t: "meta",
        url,
        size: buffer.byteLength,
        chunkSize: this.chunkSize,
        kind: meta.kind,
        contentType: meta.contentType,
        sha256: meta.sha256,
      });
      const limitBps =
        this.role === "teacher" ? this.teacherUploadLimitBps : this.studentUploadLimitBps;
      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * this.chunkSize;
        const end = Math.min(buffer.byteLength, start + this.chunkSize);
        const slice = buffer.slice(start, end);
        const backpressureOk = await waitForBackpressure(
          peer,
          this.role === "teacher" && this.seedLiteEnabled ? SEEDLITE_SEND_TIMEOUT_MS : undefined,
        );
        if (!backpressureOk) {
          throw new Error("send_timeout");
        }
        peer.send(buildChunkFrame(index, totalChunks, slice));
        const delayMs = Math.ceil((slice.byteLength / limitBps) * 1000);
        if (delayMs > 0) await sleep(delayMs);
      }
      this.sendMessage(peer, { t: "done", url });
    };

    const runSend = async () => {
      if (this.role === "teacher" && this.seedLiteEnabled) {
        recordSeedLiteWantServed();
      }
      await send();
      if (this.role === "teacher" && this.seedLiteEnabled) {
        this.seedLiteBytesSentTotal += buffer.byteLength;
        recordSeedLiteBytesSent(buffer.byteLength);
        this.evaluateSeedLiteOverheat("bytes_over_limit");
      }
      if (this.role === "student") {
        this.seedSessionBytesSent += buffer.byteLength;
        recordEpidemicWantServed();
        recordEpidemicBytesSent(buffer.byteLength);
        recordEpidemicSendSuccess(this.codeHash, buffer.byteLength);
      }
    };

    const runWithQueue = async (queue: Promise<void>, setQueue: (next: Promise<void>) => void) => {
      const prior = queue;
      let release: () => void = () => {};
      const next = new Promise<void>((resolve) => {
        release = resolve;
      });
      setQueue(next);
      await prior;
      try {
        await runSend();
      } finally {
        release();
      }
    };

    try {
      if (this.role === "teacher") {
        await runWithQueue(this.sendQueue, (next) => {
          this.sendQueue = next;
        });
        return;
      }
      if (meta.kind === "small_shard") {
        await runWithQueue(this.smallShardSendQueue, (next) => {
          this.smallShardSendQueue = next;
        });
        return;
      }
      await runSend();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "send_failed";
      if (reason === "send_timeout") {
        this.recordSeedLiteTimeout(SEEDLITE_SEND_TIMEOUT_MS);
      }
      if (isStudent) {
        const timeoutMs = reason.includes("timeout") ? SEEDLITE_SEND_TIMEOUT_MS : 0;
        recordEpidemicSendFailure(this.codeHash, { timeoutMs });
      }
      this.sendMessage(peer, { t: "err", url, code: reason });
    } finally {
      if (isStudent) {
        this.activeServePeers.delete(peerId);
      }
    }
  }

  private sendMessage(peer: Instance, message: SwarmMessage) {
    if (peer.destroyed) return;
    peer.send(JSON.stringify(message));
  }

  private touchResourceIndex(url: string, meta: ResourceIndexEntry) {
    const state = loadResourceIndex();
    const existing = state.entries.get(url);
    const entry = { ...meta, lastAccess: Date.now(), kind: meta.kind ?? "meta" };
    if (!existing) {
      state.totalBytes += entry.size;
    } else if (existing.size !== entry.size) {
      state.totalBytes += entry.size - existing.size;
    }
    state.entries.set(url, entry);
    persistResourceIndex();
  }

  private async enforceResourceCacheLimit() {
    const state = loadResourceIndex();
    const entries = Array.from(state.entries.entries()).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess,
    );
    const isSmallShard = (entry?: ResourceIndexEntry) => entry?.kind === "small_shard";
    let smallShardCount = entries.filter(([, entry]) => isSmallShard(entry)).length;
    if (
      state.totalBytes <= MAX_RESOURCE_CACHE_BYTES &&
      smallShardCount <= MAX_SMALL_SHARD_CACHE_COUNT
    ) {
      return;
    }

    if (smallShardCount > MAX_SMALL_SHARD_CACHE_COUNT) {
      for (const [url, entry] of entries) {
        if (smallShardCount <= MAX_SMALL_SHARD_CACHE_COUNT) break;
        if (!isSmallShard(entry)) continue;
        state.entries.delete(url);
        state.totalBytes -= entry.size;
        smallShardCount = Math.max(0, smallShardCount - 1);
        this.resourceCache.delete(url);
        this.resourceMeta.delete(url);
        await deleteFromDb("resource", url);
      }
    }

    if (state.totalBytes > MAX_RESOURCE_CACHE_BYTES) {
      const updatedEntries = Array.from(state.entries.entries()).sort(
        (a, b) => a[1].lastAccess - b[1].lastAccess,
      );
      for (const [url, entry] of updatedEntries) {
        if (state.totalBytes <= MAX_RESOURCE_CACHE_BYTES) break;
        state.entries.delete(url);
        state.totalBytes -= entry.size;
        this.resourceCache.delete(url);
        this.resourceMeta.delete(url);
        await deleteFromDb("resource", url);
      }
    }
    persistResourceIndex();
  }

  private assembleIncoming(incoming: IncomingTransfer) {
    const totalBytes = incoming.size;
    const output = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of incoming.chunks) {
      if (!chunk) return null;
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (incoming.kind === "wasm" && !isWasmMagic(output.buffer)) return null;
    return { url: incoming.url, buffer: output.buffer, meta: incoming };
  }

  private resolveReceive(url: string, buffer: ArrayBuffer, meta: IncomingTransfer) {
    const pending = this.pendingReceives.get(url);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    if (pending.offerTimerId) window.clearTimeout(pending.offerTimerId);
    this.pendingReceives.delete(url);
    pending.resolve({ buffer, meta });
  }

  private rejectReceive(url: string, reason: string) {
    const pending = this.pendingReceives.get(url);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    if (pending.offerTimerId) window.clearTimeout(pending.offerTimerId);
    this.pendingReceives.delete(url);
    pending.reject(reason);
  }
}

let activeSwarm: WasmSwarm | null = null;

export const setActiveWasmSwarm = (swarm: WasmSwarm | null) => {
  activeSwarm = swarm;
};

export const getActiveWasmSwarm = () => activeSwarm;
