import { DurableObject, DurableObjectState } from "cloudflare:workers";
import { decodeRealtimeEvent } from "@/lib/realtime/events";
import { normalizeFollowStateInput, type FollowState } from "@/lib/present/followState";
import type { CloudflareEnv } from "../../cloudflare-env";

const WEBSOCKET_UPGRADE_HEADER = "websocket";
const PRESENT_STATE_PREFIX = "present-state:";

export class RealtimeRoomV2 extends DurableObject {
  #state: DurableObjectState;
  #rooms = new Map<string, Set<WebSocket>>();

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    super(state, env);
    this.#state = state;
  }

  #remove(socket: WebSocket, key: string) {
    const room = this.#rooms.get(key);
    if (!room) return;
    room.delete(socket);
    if (room.size === 0) {
      this.#rooms.delete(key);
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/__diag/ping") {
      return Response.json({ ok: true });
    }

    if (url.pathname === "/__present/state") {
      if (request.method === "POST") {
        const body = await request.json<FollowState>();
        const normalized = normalizeFollowStateInput(body);
        if (!normalized) {
          return new Response("bad request", { status: 400 });
        }
        await this.#state.storage.put<FollowState>(`${PRESENT_STATE_PREFIX}${normalized.boardId}`, normalized);
        return Response.json({ ok: true });
      }

      if (request.method === "GET") {
        const boardId = url.searchParams.get("boardId");
        if (!boardId) {
          return new Response("bad request", { status: 400 });
        }
        const state = await this.#state.storage.get<FollowState>(`${PRESENT_STATE_PREFIX}${boardId}`);
        return Response.json({ ok: true, state: state ?? null });
      }

      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
    }

    if (request.method === "POST") {
      const body = await request.json<{
        roomKey?: string;
        event?: unknown;
      }>();
      if (!body.roomKey || !body.event) {
        return new Response("bad request", { status: 400 });
      }
      const decoded = decodeRealtimeEvent(body.event);
      if (!decoded) {
        return new Response("invalid event", { status: 400 });
      }
      const sockets = this.#rooms.get(body.roomKey);
      if (!sockets || sockets.size === 0) {
        return new Response("ok");
      }
      const payload = JSON.stringify(decoded);
      sockets.forEach((socket) => {
        try {
          socket.send(payload);
        } catch (error) {
          console.warn("broadcast error", error);
        }
      });
      return new Response("ok");
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    let joinedKey = "";

    server.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(String(event.data)) as {
          type?: string;
          boardId?: string;
          shareCode?: string | null;
          role?: string;
        };
        if (data.type !== "join" || !data.boardId) return;
        const key = data.shareCode ? `${data.shareCode}:${data.boardId}` : data.boardId;
        joinedKey = key;
        const room = this.#rooms.get(key) ?? new Set();
        room.add(server);
        this.#rooms.set(key, room);
      } catch (error) {
        console.warn("join failed", error);
      }
    });

    const cleanup = () => {
      if (joinedKey) {
        this.#remove(server, joinedKey);
      }
    };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }
}

export async function handleRealtimeRequest(request: Request, env: CloudflareEnv) {
  if (request.method === "GET") {
    if (request.headers.get("upgrade")?.toLowerCase() !== WEBSOCKET_UPGRADE_HEADER) {
      return new Response("Expected websocket", { status: 400 });
    }

    const url = new URL(request.url);
    const boardId = url.searchParams.get("boardId") ?? "";
    const shareCode = url.searchParams.get("shareCode") ?? undefined;
    const roomKey = shareCode ? `${shareCode}:${boardId}` : boardId;
    const id = env.REALTIME_ROOM.idFromName(roomKey);
    const stub = env.REALTIME_ROOM.get(id);
    return stub.fetch(request);
  }

  if (request.method === "POST") {
    let roomKey: string | null | undefined;
    try {
      const body = (await request.clone().json()) as { roomKey?: string | null };
      roomKey = body?.roomKey;
    } catch (error) {
      console.warn("invalid realtime post", error);
      return new Response("bad request", { status: 400 });
    }

    if (!roomKey) {
      return new Response("bad request", { status: 400 });
    }

    const id = env.REALTIME_ROOM.idFromName(roomKey);
    const stub = env.REALTIME_ROOM.get(id);
    return stub.fetch(request);
  }

  return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
}
