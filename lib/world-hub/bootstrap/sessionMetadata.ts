import { z } from "zod";

import { workerAuthorityPresenceSnapshotSchema } from "@/lib/world-hub/presence/contracts";

export const sessionAuthorityScopeSchema = z.enum(["world-hub", "mission-room"]);

export type SessionAuthorityScope = z.infer<typeof sessionAuthorityScopeSchema>;

export const sessionAuthorityMetadataSchema = z.object({
  scope: sessionAuthorityScopeSchema,
  authorityKind: z.enum(["local-preview", "edge-worker-preview"]),
  authorityEpochIso: z.string().datetime().nullable().default(null),
  ownerId: z.string().min(1).nullable().default(null),
  transferable: z.boolean().default(false),
});

export type SessionAuthorityMetadata = z.infer<typeof sessionAuthorityMetadataSchema>;

export const sessionPresenceChannelMetadataSchema = z.object({
  scope: sessionAuthorityScopeSchema,
  status: z.enum(["inactive", "reserved"]),
  transport: z.enum(["none", "worker-channel"]),
  channelKey: z.string().min(1).nullable().default(null),
  subscriptionToken: z.string().min(1).nullable().default(null),
});

export type SessionPresenceChannelMetadata = z.infer<typeof sessionPresenceChannelMetadataSchema>;

export const sessionJoinReservationMetadataSchema = z.object({
  scope: sessionAuthorityScopeSchema,
  status: z.enum(["not-required", "reserved"]),
  joinTicket: z.string().min(1).nullable().default(null),
  reservationId: z.string().min(1).nullable().default(null),
  confirmationRequired: z.boolean().default(false),
  expiresAtIso: z.string().datetime().nullable().default(null),
});

export type SessionJoinReservationMetadata = z.infer<typeof sessionJoinReservationMetadataSchema>;

export const sessionRuntimeMetadataSchema = z.object({
  authority: sessionAuthorityMetadataSchema,
  presence: sessionPresenceChannelMetadataSchema,
  reservation: sessionJoinReservationMetadataSchema,
});

export type SessionRuntimeMetadata = z.infer<typeof sessionRuntimeMetadataSchema>;

export const sessionWorkerExtensionAuthoritySchema = z.object({
  authorityKind: sessionAuthorityMetadataSchema.shape.authorityKind.optional(),
  authorityEpochIso: z.string().datetime().optional(),
  ownerId: z.string().min(1).optional(),
  transferable: z.boolean().optional(),
});

export const sessionWorkerExtensionPresenceSchema = z.object({
  channelKey: z.string().min(1),
  transport: sessionPresenceChannelMetadataSchema.shape.transport.optional(),
  subscriptionToken: z.string().min(1).optional(),
  snapshot: workerAuthorityPresenceSnapshotSchema.optional(),
});

export const sessionWorkerExtensionReservationSchema = z.object({
  joinTicket: z.string().min(1).optional(),
  reservationId: z.string().min(1).optional(),
  confirmationRequired: z.boolean().optional(),
  expiresAtIso: z.string().datetime().optional(),
});

export const sessionWorkerStructuredExtensionsSchema = z.object({
  authority: sessionWorkerExtensionAuthoritySchema.optional(),
  presence: sessionWorkerExtensionPresenceSchema.optional(),
  reservation: sessionWorkerExtensionReservationSchema.optional(),
});

export const sessionWorkerLegacyExtensionsSchema = z.object({
  joinTicket: z.string().min(1).optional(),
  presenceChannel: z.string().min(1).optional(),
  authorityMetadata: z.record(z.string(), z.string()).optional(),
});

export const sessionWorkerExtensionsSchema = z.union([
  sessionWorkerStructuredExtensionsSchema,
  sessionWorkerLegacyExtensionsSchema,
]);

export type SessionWorkerStructuredExtensions = z.infer<typeof sessionWorkerStructuredExtensionsSchema>;
export type SessionWorkerLegacyExtensions = z.infer<typeof sessionWorkerLegacyExtensionsSchema>;
export type SessionWorkerExtensions = z.infer<typeof sessionWorkerExtensionsSchema>;

function hasStructuredSessionWorkerExtensions(
  extensions: SessionWorkerExtensions,
): extensions is SessionWorkerStructuredExtensions {
  return "authority" in extensions || "presence" in extensions || "reservation" in extensions;
}

export const bootstrapSourceDiagnosticsSchema = z.object({
  strategy: z.enum(["local-default", "worker-response", "worker-fallback"]),
  endpoint: z.string().min(1).nullable().default(null),
  requestedMode: z.string().min(1),
  resolvedMode: z.string().min(1),
  usedFallback: z.boolean(),
  hasReservedAuthority: z.boolean(),
  hasReservedPresenceChannel: z.boolean(),
  hasReservedReservation: z.boolean(),
});

export type BootstrapSourceDiagnostics = z.infer<typeof bootstrapSourceDiagnosticsSchema>;

export function createLocalSessionRuntimeMetadata(scope: SessionAuthorityScope): SessionRuntimeMetadata {
  return sessionRuntimeMetadataSchema.parse({
    authority: {
      scope,
      authorityKind: "local-preview",
      authorityEpochIso: null,
      ownerId: null,
      transferable: false,
    },
    presence: {
      scope,
      status: "inactive",
      transport: "none",
      channelKey: null,
      subscriptionToken: null,
    },
    reservation: {
      scope,
      status: "not-required",
      joinTicket: null,
      reservationId: null,
      confirmationRequired: false,
      expiresAtIso: null,
    },
  });
}

export function createWorkerSessionRuntimeMetadata(args: {
  scope: SessionAuthorityScope;
  extensions?: SessionWorkerExtensions;
}): SessionRuntimeMetadata {
  const { scope, extensions } = args;

  if (!extensions) {
    return sessionRuntimeMetadataSchema.parse({
      authority: {
        scope,
        authorityKind: "edge-worker-preview",
        authorityEpochIso: null,
        ownerId: null,
        transferable: true,
      },
      presence: {
        scope,
        status: "inactive",
        transport: "none",
        channelKey: null,
        subscriptionToken: null,
      },
      reservation: {
        scope,
        status: "not-required",
        joinTicket: null,
        reservationId: null,
        confirmationRequired: false,
        expiresAtIso: null,
      },
    });
  }

  if (hasStructuredSessionWorkerExtensions(extensions)) {
    return sessionRuntimeMetadataSchema.parse({
      authority: {
        scope,
        authorityKind: extensions.authority?.authorityKind ?? "edge-worker-preview",
        authorityEpochIso: extensions.authority?.authorityEpochIso ?? null,
        ownerId: extensions.authority?.ownerId ?? null,
        transferable: extensions.authority?.transferable ?? true,
      },
      presence: {
        scope,
        status: extensions.presence ? "reserved" : "inactive",
        transport: extensions.presence?.transport ?? (extensions.presence ? "worker-channel" : "none"),
        channelKey: extensions.presence?.channelKey ?? null,
        subscriptionToken: extensions.presence?.subscriptionToken ?? null,
      },
      reservation: {
        scope,
        status:
          extensions.reservation?.joinTicket || extensions.reservation?.reservationId ? "reserved" : "not-required",
        joinTicket: extensions.reservation?.joinTicket ?? null,
        reservationId: extensions.reservation?.reservationId ?? null,
        confirmationRequired: extensions.reservation?.confirmationRequired ?? false,
        expiresAtIso: extensions.reservation?.expiresAtIso ?? null,
      },
    });
  }

  return sessionRuntimeMetadataSchema.parse({
    authority: {
      scope,
      authorityKind: "edge-worker-preview",
      authorityEpochIso: extensions.authorityMetadata?.authorityEpoch ?? null,
      ownerId: extensions.authorityMetadata?.ownerId ?? null,
      transferable: true,
    },
    presence: {
      scope,
      status: extensions.presenceChannel ? "reserved" : "inactive",
      transport: extensions.presenceChannel ? "worker-channel" : "none",
      channelKey: extensions.presenceChannel ?? null,
      subscriptionToken: null,
    },
    reservation: {
      scope,
      status: extensions.joinTicket ? "reserved" : "not-required",
      joinTicket: extensions.joinTicket ?? null,
      reservationId: extensions.authorityMetadata?.reservationId ?? null,
      confirmationRequired: false,
      expiresAtIso: null,
    },
  });
}

export function createBootstrapSourceDiagnostics(args: {
  strategy: BootstrapSourceDiagnostics["strategy"];
  endpoint?: string | null;
  requestedMode: string;
  resolvedMode: string;
  metadata: SessionRuntimeMetadata;
}): BootstrapSourceDiagnostics {
  return bootstrapSourceDiagnosticsSchema.parse({
    strategy: args.strategy,
    endpoint: args.endpoint ?? null,
    requestedMode: args.requestedMode,
    resolvedMode: args.resolvedMode,
    usedFallback: args.strategy === "worker-fallback",
    hasReservedAuthority: args.metadata.authority.authorityKind !== "local-preview",
    hasReservedPresenceChannel: args.metadata.presence.status === "reserved",
    hasReservedReservation: args.metadata.reservation.status === "reserved",
  });
}
