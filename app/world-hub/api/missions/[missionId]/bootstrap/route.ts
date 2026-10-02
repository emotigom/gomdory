import { NextResponse } from "next/server";

import {
  parseMissionRoomWorkerBootstrapRequest,
  parseMissionRoomWorkerBootstrapPayload,
} from "@/lib/world-hub/mission/contracts";

function sanitizeBootstrapToken(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 48) || "worker";
}

export async function POST(request: Request, context: { params: Promise<{ missionId: string }> }) {
  const [{ missionId }, body] = await Promise.all([context.params, request.json()]);
  const payload = parseMissionRoomWorkerBootstrapRequest(body);

  if (payload.missionId !== missionId || payload.requestedMode !== "edge-room") {
    return NextResponse.json({ error: "worker_bootstrap_unavailable" }, { status: 503 });
  }

  const token =
    payload.bootstrap.mode === "edge-room"
      ? sanitizeBootstrapToken(`${payload.missionId}-${payload.bootstrap.bootstrapKey}`)
      : sanitizeBootstrapToken(`${payload.missionId}-${payload.bootstrap.roomId}`);

  const response = parseMissionRoomWorkerBootstrapPayload({
    roomId: `worker-room-${token}`,
    roomLabel: payload.bootstrap.mode === "edge-room" ? payload.bootstrap.roomHint ?? "Worker room" : payload.bootstrap.roomLabel,
    seatLabel: payload.routeMode === "validated-handoff" ? "Worker seat A1" : "Fallback worker seat",
    connectionLabel:
      payload.routeMode === "validated-handoff"
        ? `${payload.missionId} worker room connected`
        : `${payload.missionId} worker fallback connected`,
    objectiveState: payload.routeMode === "validated-handoff" ? "ready" : "briefing",
    partySize: payload.routeMode === "validated-handoff" ? 4 : 1,
    extensions: {
      authority: {
        authorityKind: "edge-worker-preview",
        authorityEpochIso: new Date().toISOString(),
        ownerId: `mission-room:${token}`,
        transferable: false,
      },
      presence: {
        channelKey: `mission:${token}`,
        transport: "worker-channel",
        subscriptionToken: `mission-sub:${token}`,
        snapshot: {
          observedAtIso: new Date().toISOString(),
          peers: [
            { peerId: `${token}-lead`, label: "Lead", role: "guide", status: "active" },
            { peerId: `${token}-runner`, label: "Runner", role: "learner", status: "active" },
            { peerId: `${token}-observer`, label: "Observer", role: "observer", status: "idle" },
          ],
        },
      },
      reservation: {
        joinTicket: `mission-join-${token}`,
        reservationId: `mission-reservation-${token}`,
        confirmationRequired: true,
      },
    },
  });

  return NextResponse.json(response, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
