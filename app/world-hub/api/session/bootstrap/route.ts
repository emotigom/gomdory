import { NextResponse } from "next/server";

import {
  parseWorldHubWorkerBootstrapRequest,
  parseWorldHubWorkerSessionBootstrapPayload,
} from "@/lib/world-hub/contracts";

function sanitizeBootstrapToken(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 48) || "worker";
}

export async function POST(request: Request) {
  const payload = parseWorldHubWorkerBootstrapRequest(await request.json());

  if (payload.requestedMode !== "edge-session") {
    return NextResponse.json({ error: "worker_bootstrap_unavailable" }, { status: 503 });
  }

  const shardLabel = payload.bootstrap.mode === "edge-session" ? payload.bootstrap.shardHint ?? "Worker shard" : payload.bootstrap.shardLabel;
  const token =
    payload.bootstrap.mode === "edge-session"
      ? sanitizeBootstrapToken(`${payload.worldId}-${payload.bootstrap.bootstrapKey}`)
      : sanitizeBootstrapToken(`${payload.worldId}-${payload.bootstrap.sessionId}`);

  const response = parseWorldHubWorkerSessionBootstrapPayload({
    sessionId: `worker-${token}`,
    shardLabel,
    occupancy: payload.bootstrap.mode === "edge-session" ? 8 : payload.bootstrap.occupancy,
    reactionsEnabled: true,
    nearbyPeers:
      payload.bootstrap.mode === "edge-session"
        ? [
            { id: `${token}-guide`, label: "Guide", position: { x: 48, y: 46 }, mood: "wave" },
            { id: `${token}-queue`, label: "Queue", position: { x: 60, y: 58 }, mood: "queued" },
          ]
        : payload.bootstrap.nearbyPeers,
    extensions: {
      authority: {
        authorityKind: "edge-worker-preview",
        authorityEpochIso: new Date().toISOString(),
        ownerId: `hub-shard:${token}`,
        transferable: true,
      },
      presence: {
        channelKey: `presence:${token}`,
        transport: "worker-channel",
        subscriptionToken: `presence-sub:${token}`,
        snapshot: {
          observedAtIso: new Date().toISOString(),
          peers: [
            { peerId: `${token}-guide`, label: "Guide", role: "guide", status: "active" },
            { peerId: `${token}-student-a`, label: "Student A", role: "learner", status: "active" },
            { peerId: `${token}-student-b`, label: "Student B", role: "learner", status: "queued" },
          ],
        },
      },
      reservation: {
        joinTicket: `join-${token}`,
        reservationId: `reservation-${token}`,
        confirmationRequired: false,
      },
    },
  });

  return NextResponse.json(response, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
