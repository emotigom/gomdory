import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthoritativePresenceSnapshotFromWorker,
} from "@/lib/world-hub/presence/contracts";
import {
  createAuthoritativePresenceSubscription,
  createAuthoritativeSessionProjection,
  createLocalNoopPresenceSubscription,
} from "@/lib/world-hub/runtime/sessionProjection";

test("authoritative session projection normalizes reserved metadata without leaking activation tokens", () => {
  const projection = createAuthoritativeSessionProjection({
    scope: "world-hub",
    runtimeId: "worker-session-77",
    runtimeAuthority: "edge-worker",
    metadata: {
      authority: {
        scope: "world-hub",
        authorityKind: "edge-worker-preview",
        authorityEpochIso: "2026-03-21T00:00:00.000Z",
        ownerId: "hub-owner-77",
        transferable: true,
      },
      presence: {
        scope: "world-hub",
        status: "reserved",
        transport: "worker-channel",
        channelKey: "presence:worker-session-77",
        subscriptionToken: "sub-token-should-not-surface",
      },
      reservation: {
        scope: "world-hub",
        status: "reserved",
        joinTicket: "join-token-should-not-surface",
        reservationId: "reservation-77",
        confirmationRequired: true,
        expiresAtIso: "2026-03-21T00:05:00.000Z",
      },
    },
  });

  assert.equal(projection.authority.ownershipStatus, "owner-assigned");
  assert.equal(projection.presence.channelKey, "presence:worker-session-77");
  assert.equal(projection.reservation.hasJoinTicket, true);
  assert.equal(projection.reservation.activationState, "confirmation-required");
  assert.equal("subscriptionToken" in projection.presence, false);
  assert.equal("reservationId" in projection.reservation, false);
});

test("authoritative presence adapter projects worker bootstrap peers without leaking raw worker payloads", async () => {
  const projection = createAuthoritativeSessionProjection({
    scope: "world-hub",
    runtimeId: "worker-session-88",
    runtimeAuthority: "edge-worker",
    metadata: {
      authority: {
        scope: "world-hub",
        authorityKind: "edge-worker-preview",
        authorityEpochIso: null,
        ownerId: "hub-owner-88",
        transferable: true,
      },
      presence: {
        scope: "world-hub",
        status: "reserved",
        transport: "worker-channel",
        channelKey: "presence:worker-session-88",
        subscriptionToken: "worker-sub-88",
      },
      reservation: {
        scope: "world-hub",
        status: "not-required",
        joinTicket: null,
        reservationId: null,
        confirmationRequired: false,
        expiresAtIso: null,
      },
    },
  });

  const authorityPresence = createAuthoritativePresenceSnapshotFromWorker({
    observedAtIso: "2026-03-21T00:02:00.000Z",
    peers: [
      { peerId: "peer-guide", label: "Guide", role: "guide", status: "active" },
      { peerId: "peer-student", label: "Student A", role: "learner", status: "queued" },
    ],
  });

  const subscription = await createAuthoritativePresenceSubscription().subscribe({
    session: projection,
    authorityPresence,
  });

  assert.equal(subscription.adapterKind, "authoritative-bootstrap");
  assert.equal(subscription.diagnostics.mode, "authoritative-bootstrap");
  assert.equal(subscription.diagnostics.sourceKind, "worker-bootstrap");
  assert.equal(subscription.diagnostics.observedAtIso, "2026-03-21T00:02:00.000Z");
  assert.equal(subscription.peerCount, 2);
  assert.equal(subscription.peers[0]?.id, "peer-guide");
  assert.equal(subscription.peers[0]?.label, "Guide");
  assert.equal("peerId" in subscription.peers[0]!, false);
});

test("local no-op presence adapter reports deterministic diagnostics for reserved channels", async () => {
  const projection = createAuthoritativeSessionProjection({
    scope: "mission-room",
    runtimeId: "room-22",
    runtimeAuthority: "edge-worker",
    metadata: {
      authority: {
        scope: "mission-room",
        authorityKind: "edge-worker-preview",
        authorityEpochIso: null,
        ownerId: null,
        transferable: false,
      },
      presence: {
        scope: "mission-room",
        status: "reserved",
        transport: "worker-channel",
        channelKey: "mission:room-22",
        subscriptionToken: "mission-sub-22",
      },
      reservation: {
        scope: "mission-room",
        status: "not-required",
        joinTicket: null,
        reservationId: null,
        confirmationRequired: false,
        expiresAtIso: null,
      },
    },
  });

  const subscription = await createLocalNoopPresenceSubscription().subscribe({ session: projection });

  assert.equal(subscription.adapterKind, "local-noop");
  assert.equal(subscription.diagnostics.mode, "reserved-channel-pending");
  assert.equal(subscription.channelKey, "mission:room-22");
  assert.equal(subscription.peerCount, 0);
  assert.deepEqual(subscription.peers, []);
});
