import { z } from "zod";

export const authoritativePresencePeerRoleSchema = z.enum(["learner", "guide", "observer"]);

export type AuthoritativePresencePeerRole = z.infer<typeof authoritativePresencePeerRoleSchema>;

export const authoritativePresencePeerStatusSchema = z.enum(["active", "queued", "idle"]);

export type AuthoritativePresencePeerStatus = z.infer<typeof authoritativePresencePeerStatusSchema>;

export const workerAuthorityPresencePeerSchema = z.object({
  peerId: z.string().min(1),
  label: z.string().min(1),
  role: authoritativePresencePeerRoleSchema.default("learner"),
  status: authoritativePresencePeerStatusSchema.default("active"),
});

export type WorkerAuthorityPresencePeer = z.infer<typeof workerAuthorityPresencePeerSchema>;

export const workerAuthorityPresenceSnapshotSchema = z.object({
  observedAtIso: z.string().datetime(),
  peers: z.array(workerAuthorityPresencePeerSchema).readonly(),
});

export type WorkerAuthorityPresenceSnapshot = z.infer<typeof workerAuthorityPresenceSnapshotSchema>;

export const authoritativePresencePeerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  role: authoritativePresencePeerRoleSchema,
  status: authoritativePresencePeerStatusSchema,
});

export type AuthoritativePresencePeer = z.infer<typeof authoritativePresencePeerSchema>;

export const authoritativePresenceSnapshotSourceKindSchema = z.enum(["worker-bootstrap"]);

export type AuthoritativePresenceSnapshotSourceKind = z.infer<typeof authoritativePresenceSnapshotSourceKindSchema>;

export const authoritativePresenceSnapshotSchema = z.object({
  sourceKind: authoritativePresenceSnapshotSourceKindSchema,
  observedAtIso: z.string().datetime(),
  peerCount: z.number().int().nonnegative(),
  peers: z.array(authoritativePresencePeerSchema).readonly(),
});

export type AuthoritativePresenceSnapshot = z.infer<typeof authoritativePresenceSnapshotSchema>;

export function createAuthoritativePresenceSnapshotFromWorker(
  input: WorkerAuthorityPresenceSnapshot,
): AuthoritativePresenceSnapshot {
  const parsed = workerAuthorityPresenceSnapshotSchema.parse(input);
  const peers = parsed.peers.map((peer) =>
    authoritativePresencePeerSchema.parse({
      id: peer.peerId,
      label: peer.label,
      role: peer.role,
      status: peer.status,
    }),
  );

  return authoritativePresenceSnapshotSchema.parse({
    sourceKind: "worker-bootstrap",
    observedAtIso: parsed.observedAtIso,
    peerCount: peers.length,
    peers,
  });
}
