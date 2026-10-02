import type { PeerInfo } from "./signalClient";
import { SignalClient } from "./signalClient";
import { getChunk, getChunkMeta, markComplete, putChunk, setChunkMeta } from "./chunkStore";
import { arrayBufferToBase64, base64ToArrayBuffer, delay, withTimeout } from "./utils";
import { setP2PPeerCounts } from "./p2pState";

type PeerRole = "teacher" | "student";

type SwarmOptions = {
  signalClient: SignalClient;
  peerId: string;
  role: PeerRole;
  maxPeers: number;
  uploadBytesPerSec: number;
};

type PeerRecord = {
  connection: RTCPeerConnection;
  channel: RTCDataChannel | null;
  role: PeerRole;
  connected: boolean;
};

type FileMeta = {
  totalSize: number;
  chunkSize: number;
  contentType?: string | null;
};

type PeerFileState = {
  meta: FileMeta;
  complete: boolean;
  chunks: Set<number>;
};

type SignalPayload =
  | { sdp: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit };

type DataMessage =
  | { type: "ping"; id: string }
  | { type: "pong"; id: string }
  | { type: "have"; url: string; index: number; totalSize: number; chunkSize: number; contentType?: string | null }
  | { type: "complete"; url: string; totalSize: number; chunkSize: number; contentType?: string | null }
  | { type: "need"; requestId: string; url: string; index: number }
  | {
      type: "chunk";
      requestId: string;
      url: string;
      index: number;
      data: string;
      totalSize: number;
      chunkSize: number;
      contentType?: string | null;
    };

type PendingRequest = {
  resolve: (data: ArrayBuffer) => void;
  reject: (error: Error) => void;
};

class UploadLimiter {
  private readonly bytesPerSec: number;
  private tokens: number;
  private lastRefill: number;

  constructor(bytesPerSec: number) {
    this.bytesPerSec = bytesPerSec;
    this.tokens = bytesPerSec;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const refillAmount = (elapsed / 1000) * this.bytesPerSec;
    this.tokens = Math.min(this.bytesPerSec, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  async take(bytes: number) {
    if (this.bytesPerSec <= 0) return;
    while (true) {
      this.refill();
      if (this.tokens >= bytes) {
        this.tokens -= bytes;
        return;
      }
      const needed = bytes - this.tokens;
      const waitMs = Math.max(10, (needed / this.bytesPerSec) * 1000);
      await delay(waitMs);
    }
  }
}

export class PeerSwarm {
  private readonly options: SwarmOptions;
  private readonly peers = new Map<string, PeerRecord>();
  private readonly peerFiles = new Map<string, Map<string, PeerFileState>>();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly uploadLimiter: UploadLimiter;

  constructor(options: SwarmOptions) {
    this.options = options;
    this.uploadLimiter = new UploadLimiter(options.uploadBytesPerSec);
  }

  start() {
    this.options.signalClient.connect();
  }

  connectPeers(peers: PeerInfo[]) {
    for (const peer of peers) {
      this.ensurePeer(peer.peerId, peer.role, true);
    }
  }

  handlePeerJoined(peer: PeerInfo) {
    this.ensurePeer(peer.peerId, peer.role, false);
  }

  handlePeerLeft(peerId: string) {
    const record = this.peers.get(peerId);
    record?.channel?.close();
    record?.connection.close();
    this.peers.delete(peerId);
    this.peerFiles.delete(peerId);
    this.updateCounts();
  }

  handleSignal(from: string, data: unknown) {
    const record = this.peers.get(from);
    if (!record) {
      this.ensurePeer(from, "student", false);
    }
    const payload = data as SignalPayload;
    const target = this.peers.get(from);
    if (!target) return;
    if ("sdp" in payload) {
      void this.handleSessionDescription(from, payload.sdp);
    } else if ("candidate" in payload) {
      void target.connection.addIceCandidate(payload.candidate).catch(() => {
        // ignore candidate errors
      });
    }
  }

  async probe(timeoutMs: number) {
    const connectedPeer = Array.from(this.peers.entries()).find(([, record]) => record.connected);
    if (!connectedPeer) {
      return false;
    }
    const [, record] = connectedPeer;
    if (!record.channel) return false;
    const pingId = crypto.randomUUID();
    const pongPromise = new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(pingId, {
        resolve: () => resolve(),
        reject,
      });
    });
    record.channel.send(JSON.stringify({ type: "ping", id: pingId } satisfies DataMessage));

    try {
      await withTimeout(pongPromise, timeoutMs, "p2p_probe_timeout");
      return true;
    } catch {
      return false;
    } finally {
      this.pendingRequests.delete(pingId);
    }
  }

  getConnectedPeers() {
    return Array.from(this.peers.entries()).filter(([, record]) => record.connected).map(([id]) => id);
  }

  hasCompletePeer(url: string) {
    for (const [peerId, files] of this.peerFiles.entries()) {
      const state = files.get(url);
      if (state?.complete) {
        return { peerId, meta: state.meta };
      }
    }
    return null;
  }

  async requestChunkFromPeer(peerId: string, url: string, index: number, timeoutMs: number) {
    const record = this.peers.get(peerId);
    if (!record?.channel || !record.connected) {
      throw new Error("peer_not_connected");
    }

    const requestId = crypto.randomUUID();
    const responsePromise = new Promise<ArrayBuffer>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
    });

    record.channel.send(JSON.stringify({ type: "need", requestId, url, index } satisfies DataMessage));

    try {
      return await withTimeout(responsePromise, timeoutMs, "chunk_timeout");
    } finally {
      this.pendingRequests.delete(requestId);
    }
  }

  async announceChunk(url: string, index: number, meta: FileMeta) {
    const payload: DataMessage = {
      type: "have",
      url,
      index,
      totalSize: meta.totalSize,
      chunkSize: meta.chunkSize,
      contentType: meta.contentType,
    };
    for (const record of this.peers.values()) {
      if (!record.connected || !record.channel) continue;
      record.channel.send(JSON.stringify(payload));
    }
  }

  async announceComplete(url: string, meta: FileMeta) {
    const payload: DataMessage = {
      type: "complete",
      url,
      totalSize: meta.totalSize,
      chunkSize: meta.chunkSize,
      contentType: meta.contentType,
    };
    for (const record of this.peers.values()) {
      if (!record.connected || !record.channel) continue;
      record.channel.send(JSON.stringify(payload));
    }
  }

  private ensurePeer(peerId: string, role: PeerRole, initiator: boolean) {
    if (this.peers.has(peerId)) return;
    if (this.peers.size >= this.options.maxPeers) return;

    const connection = new RTCPeerConnection({ iceServers: [] });
    const record: PeerRecord = { connection, channel: null, role, connected: false };
    this.peers.set(peerId, record);

    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.options.signalClient.sendSignal(peerId, { candidate: event.candidate.toJSON() });
    };

    connection.onconnectionstatechange = () => {
      const connected = connection.connectionState === "connected";
      record.connected = connected;
      this.updateCounts();
      if (connection.connectionState === "failed" || connection.connectionState === "closed") {
        this.handlePeerLeft(peerId);
      }
    };

    connection.ondatachannel = (event) => {
      record.channel = event.channel;
      this.attachChannelHandlers(peerId, record.channel);
    };

    if (initiator) {
      const channel = connection.createDataChannel("data");
      record.channel = channel;
      this.attachChannelHandlers(peerId, channel);
      void this.createOffer(peerId);
    }
  }

  private attachChannelHandlers(peerId: string, channel: RTCDataChannel) {
    channel.onopen = () => {
      const record = this.peers.get(peerId);
      if (record) {
        record.connected = true;
        this.updateCounts();
      }
    };
    channel.onclose = () => this.handlePeerLeft(peerId);
    channel.onerror = () => this.handlePeerLeft(peerId);
    channel.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as DataMessage;
        void this.handleMessage(peerId, message);
      } catch {
        // ignore malformed
      }
    };
  }

  private async createOffer(peerId: string) {
    const record = this.peers.get(peerId);
    if (!record) return;
    const offer = await record.connection.createOffer();
    await record.connection.setLocalDescription(offer);
    if (record.connection.localDescription) {
      this.options.signalClient.sendSignal(peerId, { sdp: record.connection.localDescription });
    }
  }

  private async handleSessionDescription(peerId: string, sdp: RTCSessionDescriptionInit) {
    const record = this.peers.get(peerId);
    if (!record) return;
    await record.connection.setRemoteDescription(new RTCSessionDescription(sdp));
    if (sdp.type === "offer") {
      const answer = await record.connection.createAnswer();
      await record.connection.setLocalDescription(answer);
      if (record.connection.localDescription) {
        this.options.signalClient.sendSignal(peerId, { sdp: record.connection.localDescription });
      }
    }
  }

  private updateCounts() {
    const connected = this.getConnectedPeers().length;
    setP2PPeerCounts(this.peers.size, connected);
  }

  private async handleMessage(peerId: string, message: DataMessage) {
    if (message.type === "ping") {
      const record = this.peers.get(peerId);
      if (record?.connected && record.channel) {
        record.channel.send(JSON.stringify({ type: "pong", id: message.id } satisfies DataMessage));
      }
      return;
    }
    if (message.type === "pong") {
      const pending = this.pendingRequests.get(message.id);
      pending?.resolve(new ArrayBuffer(0));
      return;
    }

    if (message.type === "have" || message.type === "complete") {
      const files = this.peerFiles.get(peerId) ?? new Map<string, PeerFileState>();
      const meta: FileMeta = {
        totalSize: message.totalSize,
        chunkSize: message.chunkSize,
        contentType: message.contentType,
      };
      const existing =
        files.get(message.url) ??
        ({ meta, complete: false, chunks: new Set<number>() } satisfies PeerFileState);
      existing.meta = meta;
      if (message.type === "have") {
        existing.chunks.add(message.index);
      }
      if (message.type === "complete") {
        existing.complete = true;
      }
      files.set(message.url, existing);
      this.peerFiles.set(peerId, files);
      return;
    }

    if (message.type === "need") {
      const record = this.peers.get(peerId);
      if (!record?.connected || !record.channel) return;
      const chunk = await getChunk(message.url, message.index);
      const meta = await getChunkMeta(message.url);
      if (!chunk || !meta) return;
      await this.uploadLimiter.take(chunk.byteLength);
      const payload: DataMessage = {
        type: "chunk",
        requestId: message.requestId,
        url: message.url,
        index: message.index,
        data: arrayBufferToBase64(chunk),
        totalSize: meta.totalSize,
        chunkSize: meta.chunkSize,
        contentType: meta.contentType,
      };
      record.channel.send(JSON.stringify(payload));
      return;
    }

    if (message.type === "chunk") {
      const buffer = base64ToArrayBuffer(message.data);
      await setChunkMeta({
        url: message.url,
        chunkSize: message.chunkSize,
        totalSize: message.totalSize,
        contentType: message.contentType,
        complete: false,
      });
      await putChunk(message.url, message.index, buffer);
      const totalChunks = Math.ceil(message.totalSize / message.chunkSize);
      if (message.index + 1 >= totalChunks) {
        await markComplete(message.url);
      }
      const pending = this.pendingRequests.get(message.requestId);
      pending?.resolve(buffer);
    }
  }
}
