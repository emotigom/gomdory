import { z } from "zod";

export const metaverseIdentityProfileSummarySchema = z.object({
  status: z.enum(["empty", "ready"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  hasCompletedMission: z.boolean(),
  hasRecentReward: z.boolean(),
  lastMissionId: z.string().min(1).nullable().default(null),
  lastMissionTitle: z.string().min(1).nullable().default(null),
  completedAtIso: z.string().datetime().nullable().default(null),
  completionLabel: z.string().min(1).nullable().default(null),
  rewardLabel: z.string().min(1).nullable().default(null),
  persistenceLabel: z.string().min(1).nullable().default(null),
});

export type MetaverseIdentityProfileSummary = z.infer<typeof metaverseIdentityProfileSummarySchema>;

export const metaverseIdentityCollectibleSummarySchema = z.object({
  status: z.enum(["empty", "placeholder"]),
  summaryLabel: z.string().min(1),
  summaryDetail: z.string().min(1),
  highlightedCollectibleLabel: z.string().min(1).nullable().default(null),
  collectibleCount: z.number().int().nonnegative(),
  inventoryUpdateCount: z.number().int().nonnegative(),
});

export type MetaverseIdentityCollectibleSummary = z.infer<typeof metaverseIdentityCollectibleSummarySchema>;

export const metaverseIdentitySourceDiagnosticsSchema = z.object({
  deterministic: z.boolean(),
  derivedFrom: z.enum(["recent-mission-result", "persisted-progress", "deterministic-local-fallback"]),
  progressSourceKind: z.enum(["supabase", "local-storage-fallback", "empty-local", "unavailable", "not-available"]),
  rewardSourceKind: z.enum(["mission-result", "progress-snapshot", "none"]),
  resolvedAtIso: z.string().datetime(),
});

export type MetaverseIdentitySourceDiagnostics = z.infer<typeof metaverseIdentitySourceDiagnosticsSchema>;

export const metaverseIdentityFallbackBehaviorSchema = z.object({
  mode: z.enum(["deterministic-local", "authoritative-hybrid"]),
  reason: z.enum([
    "profile-not-connected",
    "inventory-not-connected",
    "recent-result-unavailable",
    "progress-unavailable",
    "not-needed",
  ]),
  label: z.string().min(1),
  detail: z.string().min(1),
});

export type MetaverseIdentityFallbackBehavior = z.infer<typeof metaverseIdentityFallbackBehaviorSchema>;

export const metaverseResolvedIdentitySummarySchema = z.object({
  profile: metaverseIdentityProfileSummarySchema,
  collectible: metaverseIdentityCollectibleSummarySchema,
  source: z.object({
    kind: z.enum(["deterministic-local", "resolved-metaverse-summary"]),
    label: z.string().min(1),
    detail: z.string().min(1),
    diagnostics: metaverseIdentitySourceDiagnosticsSchema,
  }),
  fallback: metaverseIdentityFallbackBehaviorSchema,
});

export type MetaverseResolvedIdentitySummary = z.infer<typeof metaverseResolvedIdentitySummarySchema>;

export function parseMetaverseResolvedIdentitySummary(input: unknown): MetaverseResolvedIdentitySummary {
  return metaverseResolvedIdentitySummarySchema.parse(input);
}
