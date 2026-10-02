import { z } from "zod";

import {
  sessionAuthorityScopeSchema,
  sessionRuntimeMetadataSchema,
} from "@/lib/world-hub/bootstrap/sessionMetadata";
import { authoritativePresenceSnapshotSchema } from "@/lib/world-hub/presence/contracts";

export const runtimeAuthoritySchema = z.enum(["local-preview", "edge-worker"]);

export type RuntimeAuthority = z.infer<typeof runtimeAuthoritySchema>;

export const sessionOwnershipStatusSchema = z.enum(["local-only", "owner-assigned", "owner-pending"]);

export type SessionOwnershipStatus = z.infer<typeof sessionOwnershipStatusSchema>;

export const reservationActivationStateSchema = z.enum([
  "not-required",
  "pending-activation",
  "confirmation-required",
]);

export type ReservationActivationState = z.infer<typeof reservationActivationStateSchema>;

export const authoritativeSessionProjectionSchema = z.object({
  scope: sessionAuthorityScopeSchema,
  runtimeId: z.string().min(1),
  runtimeAuthority: runtimeAuthoritySchema,
  authority: z.object({
    authorityKind: sessionRuntimeMetadataSchema.shape.authority.shape.authorityKind,
    authorityEpochIso: z.string().datetime().nullable().default(null),
    ownerId: z.string().min(1).nullable().default(null),
    transferable: z.boolean().default(false),
    ownershipStatus: sessionOwnershipStatusSchema,
  }),
  presence: z.object({
    status: sessionRuntimeMetadataSchema.shape.presence.shape.status,
    transport: sessionRuntimeMetadataSchema.shape.presence.shape.transport,
    channelKey: z.string().min(1).nullable().default(null),
    subscriptionReadiness: z.enum(["inactive", "reserved"]),
  }),
  reservation: z.object({
    status: sessionRuntimeMetadataSchema.shape.reservation.shape.status,
    activationState: reservationActivationStateSchema,
    expiresAtIso: z.string().datetime().nullable().default(null),
    hasJoinTicket: z.boolean(),
  }),
  diagnostics: z.object({
    hasReservedPresenceChannel: z.boolean(),
    hasJoinReservation: z.boolean(),
    supportsOwnershipTransfer: z.boolean(),
  }),
});

export type AuthoritativeSessionProjection = z.infer<typeof authoritativeSessionProjectionSchema>;

export const presenceSubscriptionTargetSchema = z.object({
  session: authoritativeSessionProjectionSchema,
  authorityPresence: authoritativePresenceSnapshotSchema.nullable().default(null),
});

export type PresenceSubscriptionTarget = z.infer<typeof presenceSubscriptionTargetSchema>;

export const presenceSubscriptionAdapterKindSchema = z.enum(["local-noop", "authoritative-bootstrap"]);

export type PresenceSubscriptionAdapterKind = z.infer<typeof presenceSubscriptionAdapterKindSchema>;

export const presenceSubscriptionLifecycleSchema = z.enum(["ready"]);

export type PresenceSubscriptionLifecycle = z.infer<typeof presenceSubscriptionLifecycleSchema>;

export const presenceSubscriptionDiagnosticModeSchema = z.enum([
  "deterministic-local",
  "reserved-channel-pending",
  "authoritative-bootstrap",
]);

export type PresenceSubscriptionDiagnosticMode = z.infer<typeof presenceSubscriptionDiagnosticModeSchema>;

export const presenceSubscriptionDiagnosticsSchema = z.object({
  adapterKind: presenceSubscriptionAdapterKindSchema,
  lifecycle: presenceSubscriptionLifecycleSchema,
  mode: presenceSubscriptionDiagnosticModeSchema,
  detail: z.string().min(1),
  channelStatus: authoritativeSessionProjectionSchema.shape.presence.shape.status,
  transport: authoritativeSessionProjectionSchema.shape.presence.shape.transport,
  sourceKind: z.enum(["deterministic-local", "worker-bootstrap"]),
  observedAtIso: z.string().datetime().nullable().default(null),
});

export type PresenceSubscriptionDiagnostics = z.infer<typeof presenceSubscriptionDiagnosticsSchema>;

export const presenceSubscriptionSnapshotSchema = z.object({
  adapterKind: presenceSubscriptionAdapterKindSchema,
  lifecycle: presenceSubscriptionLifecycleSchema,
  peerCount: z.number().int().nonnegative(),
  channelKey: z.string().min(1).nullable().default(null),
  peers: authoritativePresenceSnapshotSchema.shape.peers.default([]),
  diagnostics: presenceSubscriptionDiagnosticsSchema,
});

export type PresenceSubscriptionSnapshot = z.infer<typeof presenceSubscriptionSnapshotSchema>;

export type PresenceSubscriptionPort = {
  subscribe(target: PresenceSubscriptionTarget): Promise<PresenceSubscriptionSnapshot>;
};

export function createAuthoritativeSessionProjection(args: {
  scope: AuthoritativeSessionProjection["scope"];
  runtimeId: string;
  runtimeAuthority: RuntimeAuthority;
  metadata: z.infer<typeof sessionRuntimeMetadataSchema>;
}): AuthoritativeSessionProjection {
  const { metadata, runtimeAuthority, runtimeId, scope } = args;

  const ownershipStatus: SessionOwnershipStatus =
    runtimeAuthority === "local-preview"
      ? "local-only"
      : metadata.authority.ownerId
        ? "owner-assigned"
        : "owner-pending";

  const activationState: ReservationActivationState =
    metadata.reservation.status !== "reserved"
      ? "not-required"
      : metadata.reservation.confirmationRequired
        ? "confirmation-required"
        : "pending-activation";

  return authoritativeSessionProjectionSchema.parse({
    scope,
    runtimeId,
    runtimeAuthority,
    authority: {
      authorityKind: metadata.authority.authorityKind,
      authorityEpochIso: metadata.authority.authorityEpochIso,
      ownerId: metadata.authority.ownerId,
      transferable: metadata.authority.transferable,
      ownershipStatus,
    },
    presence: {
      status: metadata.presence.status,
      transport: metadata.presence.transport,
      channelKey: metadata.presence.channelKey,
      subscriptionReadiness: metadata.presence.status === "reserved" ? "reserved" : "inactive",
    },
    reservation: {
      status: metadata.reservation.status,
      activationState,
      expiresAtIso: metadata.reservation.expiresAtIso,
      hasJoinTicket: Boolean(metadata.reservation.joinTicket),
    },
    diagnostics: {
      hasReservedPresenceChannel: metadata.presence.status === "reserved",
      hasJoinReservation: metadata.reservation.status === "reserved",
      supportsOwnershipTransfer: metadata.authority.transferable,
    },
  });
}

export function createLocalNoopPresenceSubscription(): PresenceSubscriptionPort {
  return {
    async subscribe(target) {
      const parsedTarget = presenceSubscriptionTargetSchema.parse(target);
      const reservedChannel = parsedTarget.session.presence.status === "reserved";

      return presenceSubscriptionSnapshotSchema.parse({
        adapterKind: "local-noop",
        lifecycle: "ready",
        peerCount: 0,
        channelKey: parsedTarget.session.presence.channelKey,
        peers: [],
        diagnostics: {
          adapterKind: "local-noop",
          lifecycle: "ready",
          mode: reservedChannel ? "reserved-channel-pending" : "deterministic-local",
          detail: reservedChannel
            ? "Presence channel metadata was reserved, but the runtime intentionally stayed on the deterministic local no-op subscription path."
            : "Presence subscription remains a deterministic local no-op until an authority-backed source is available.",
          channelStatus: parsedTarget.session.presence.status,
          transport: parsedTarget.session.presence.transport,
          sourceKind: "deterministic-local",
          observedAtIso: null,
        },
      });
    },
  };
}

export function createAuthoritativePresenceSubscription(args?: {
  fallback?: PresenceSubscriptionPort;
}): PresenceSubscriptionPort {
  const fallback = args?.fallback ?? createLocalNoopPresenceSubscription();

  return {
    async subscribe(target) {
      const parsedTarget = presenceSubscriptionTargetSchema.parse(target);

      if (!parsedTarget.authorityPresence) {
        return fallback.subscribe(parsedTarget);
      }

      return presenceSubscriptionSnapshotSchema.parse({
        adapterKind: "authoritative-bootstrap",
        lifecycle: "ready",
        peerCount: parsedTarget.authorityPresence.peerCount,
        channelKey: parsedTarget.session.presence.channelKey,
        peers: parsedTarget.authorityPresence.peers,
        diagnostics: {
          adapterKind: "authoritative-bootstrap",
          lifecycle: "ready",
          mode: "authoritative-bootstrap",
          detail:
            parsedTarget.authorityPresence.peerCount > 0
              ? `Consumed ${parsedTarget.authorityPresence.peerCount} authority-projected presence peer(s) from the worker bootstrap snapshot.`
              : "Authority-backed presence snapshot resolved successfully, but it currently projects zero peers.",
          channelStatus: parsedTarget.session.presence.status,
          transport: parsedTarget.session.presence.transport,
          sourceKind: parsedTarget.authorityPresence.sourceKind,
          observedAtIso: parsedTarget.authorityPresence.observedAtIso,
        },
      });
    },
  };
}
