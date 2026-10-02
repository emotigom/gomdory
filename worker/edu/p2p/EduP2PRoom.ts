import type { CloudflareEnv } from "../../../cloudflare-env";

type JoinPayload = {
  type: "join";
  roomKey: string;
  peerId: string;
  role: "teacher" | "student";
};

type SignalPayload = {
  type: "signal";
  to: string;
  from: string;
  data: unknown;
};

type IncomingMessage = JoinPayload | SignalPayload;

type LeaseRecord = {
  peerId: string;
  expiresAt: number;
};

type PeerInfo = {
  peerId: string;
  role: "teacher" | "student";
};

const DEFAULT_LEASE_TTL_MS = 12_000;
const DEFAULT_MAX_DOWNLOADS = 2;
const MIN_RETRY_MS = 400;

export class EduP2PRoom {
  private readonly state: DurableObjectState;
  private readonly env: CloudflareEnv;
  private readonly peers = new Map<string, WebSocket>();
  private readonly peerInfo = new Map<string, PeerInfo>();
  private readonly leases = new Map<string, LeaseRecord>();

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    this.state = state;
    this.env = env;
  }

  private pruneLeases(now: number) {
    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.expiresAt <= now) {
        this.leases.delete(leaseId);
      }
    }
  }

  private countActiveLeases(now: number) {
    this.pruneLeases(now);
    return this.leases.size;
  }

  private getMaxDownloads() {
    const raw = this.env.EDU_MAX_ORIGIN_DOWNLOADS_PER_ROOM;
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_DOWNLOADS;
  }

  private getLeaseTtlMs() {
    const raw = this.env.EDU_ORIGIN_LEASE_TTL_MS;
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 1000 ? parsed : DEFAULT_LEASE_TTL_MS;
  }

  private getNextRetryMs(now: number) {
    let soonest = Infinity;
    for (const lease of this.leases.values()) {
      if (lease.expiresAt < soonest) {
        soonest = lease.expiresAt;
      }
    }
    if (!Number.isFinite(soonest)) return MIN_RETRY_MS;
    return Math.max(MIN_RETRY_MS, soonest - now);
  }

  private handleJoin(ws: WebSocket, payload: JoinPayload) {
    this.peers.set(payload.peerId, ws);
    this.peerInfo.set(payload.peerId, {
      peerId: payload.peerId,
      role: payload.role,
    });

    const peers = Array.from(this.peerInfo.values()).filter((peer) => peer.peerId !== payload.peerId);

    ws.send(
      JSON.stringify({
        type: "peers",
        peers,
      }),
    );

    for (const [peerId, socket] of this.peers.entries()) {
      if (peerId === payload.peerId) continue;
      socket.send(
        JSON.stringify({
          type: "peer-joined",
          peerId: payload.peerId,
          role: payload.role,
        }),
      );
    }
  }

  private handleSignal(payload: SignalPayload) {
    const target = this.peers.get(payload.to);
    if (!target) return;
    target.send(JSON.stringify(payload));
  }

  private handleSocketMessage(ws: WebSocket, message: IncomingMessage) {
    if (message.type === "join") {
      this.handleJoin(ws, message);
      return;
    }
    if (message.type === "signal") {
      this.handleSignal(message);
    }
  }

  private handleSocketClose(ws: WebSocket) {
    let removedPeerId: string | null = null;
    for (const [peerId, socket] of this.peers.entries()) {
      if (socket === ws) {
        this.peers.delete(peerId);
        this.peerInfo.delete(peerId);
        removedPeerId = peerId;
        break;
      }
    }

    if (!removedPeerId) return;

    for (const socket of this.peers.values()) {
      socket.send(
        JSON.stringify({
          type: "peer-left",
          peerId: removedPeerId,
        }),
      );
    }
  }

  private async handleLease(request: Request) {
    const now = Date.now();
    const maxDownloads = this.getMaxDownloads();
    this.pruneLeases(now);

    if (this.countActiveLeases(now) >= maxDownloads) {
      return Response.json(
        {
          ok: false,
          retryAfterMs: this.getNextRetryMs(now),
        },
        { status: 429 },
      );
    }

    const payload = (await request.json()) as { peerId?: string };
    const peerId = payload.peerId ?? "";
    if (!peerId) {
      return Response.json({ ok: false, error: "missing_peer" }, { status: 400 });
    }

    const leaseId = crypto.randomUUID();
    const ttlMs = this.getLeaseTtlMs();
    this.leases.set(leaseId, { peerId, expiresAt: now + ttlMs });

    return Response.json({ ok: true, leaseId, ttlMs });
  }

  private async handleLeaseRenew(request: Request) {
    const payload = (await request.json()) as { leaseId?: string; peerId?: string };
    const leaseId = payload.leaseId ?? "";
    const peerId = payload.peerId ?? "";
    if (!leaseId || !peerId) {
      return Response.json({ ok: false, error: "missing_payload" }, { status: 400 });
    }

    const lease = this.leases.get(leaseId);
    if (!lease || lease.peerId !== peerId) {
      return Response.json({ ok: false, error: "lease_not_found" }, { status: 404 });
    }

    const ttlMs = this.getLeaseTtlMs();
    lease.expiresAt = Date.now() + ttlMs;
    this.leases.set(leaseId, lease);

    return Response.json({ ok: true, ttlMs });
  }

  private async handleLeaseRelease(request: Request) {
    const payload = (await request.json()) as { leaseId?: string; peerId?: string };
    const leaseId = payload.leaseId ?? "";
    const peerId = payload.peerId ?? "";
    if (!leaseId || !peerId) {
      return Response.json({ ok: false, error: "missing_payload" }, { status: 400 });
    }

    const lease = this.leases.get(leaseId);
    if (!lease || lease.peerId !== peerId) {
      return Response.json({ ok: false, error: "lease_not_found" }, { status: 404 });
    }

    this.leases.delete(leaseId);
    return Response.json({ ok: true });
  }

  async fetch(request: Request) {
    if (request.headers.get("upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.state.acceptWebSocket(server);

      server.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        try {
          const parsed = JSON.parse(event.data) as IncomingMessage;
          this.handleSocketMessage(server, parsed);
        } catch {
          // ignore malformed messages
        }
      });

      server.addEventListener("close", () => this.handleSocketClose(server));
      server.addEventListener("error", () => this.handleSocketClose(server));

      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    if (url.pathname.endsWith("/lease")) {
      return this.handleLease(request);
    }

    if (url.pathname.endsWith("/lease/renew")) {
      return this.handleLeaseRenew(request);
    }

    if (url.pathname.endsWith("/lease/release")) {
      return this.handleLeaseRelease(request);
    }

    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
}
