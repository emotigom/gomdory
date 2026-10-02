import { z } from "zod";

export const metaverseRewardPlaceholderStatusSchema = z.enum(["pending", "placeholder", "unavailable"]);

export type MetaverseRewardPlaceholderStatus = z.infer<typeof metaverseRewardPlaceholderStatusSchema>;

export const metaverseRewardSummaryPlaceholderSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  highlightedRewardLabel: z.string().min(1).nullable().default(null),
  placeholderCount: z.number().int().nonnegative(),
  inventoryUpdateCount: z.number().int().nonnegative(),
});

export type MetaverseRewardSummaryPlaceholder = z.infer<typeof metaverseRewardSummaryPlaceholderSchema>;

export const metaverseInventoryUpdatePlaceholderSchema = z.object({
  id: z.string().min(1),
  target: z.enum(["mission-ledger", "profile-inventory", "classroom-report"]),
  label: z.string().min(1),
  detail: z.string().min(1),
  quantity: z.number().int().positive().nullable().default(null),
  status: metaverseRewardPlaceholderStatusSchema,
});

export type MetaverseInventoryUpdatePlaceholder = z.infer<typeof metaverseInventoryUpdatePlaceholderSchema>;

export const metaverseRewardHookFallbackSchema = z.object({
  mode: z.enum(["deterministic-local", "authoritative-service"]),
  reason: z.enum(["preview-safe-default", "service-not-configured", "inventory-not-connected"]),
  label: z.string().min(1),
  detail: z.string().min(1),
});

export type MetaverseRewardHookFallback = z.infer<typeof metaverseRewardHookFallbackSchema>;

export const metaverseRewardHookSourceDiagnosticsSchema = z.object({
  deterministic: z.boolean(),
  derivedFrom: z.enum(["mission-completion", "authoritative-reward-service"]),
  placeholderCount: z.number().int().nonnegative(),
  inventoryUpdateCount: z.number().int().nonnegative(),
  rewardServiceStatus: z.enum(["not-connected", "placeholder-only", "authoritative-placeholder"]),
  inventoryServiceStatus: z.enum(["not-connected", "placeholder-only", "authoritative-placeholder"]),
  emittedAtIso: z.string().datetime(),
});

export type MetaverseRewardHookSourceDiagnostics = z.infer<typeof metaverseRewardHookSourceDiagnosticsSchema>;

export const metaverseRewardHookSourceSchema = z.object({
  kind: z.enum(["deterministic-local", "authoritative-placeholder"]),
  label: z.string().min(1),
  detail: z.string().min(1),
  diagnostics: metaverseRewardHookSourceDiagnosticsSchema,
});

export type MetaverseRewardHookSource = z.infer<typeof metaverseRewardHookSourceSchema>;

export const metaverseMissionRewardHookResolvedSchema = z.object({
  status: metaverseRewardPlaceholderStatusSchema,
  summary: metaverseRewardSummaryPlaceholderSchema,
  inventoryUpdates: z.array(metaverseInventoryUpdatePlaceholderSchema).readonly(),
  source: metaverseRewardHookSourceSchema,
  fallback: metaverseRewardHookFallbackSchema,
});

export type MetaverseMissionRewardHookResolved = z.infer<typeof metaverseMissionRewardHookResolvedSchema>;

export const metaverseMissionRewardHookInputSchema = z.object({
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  returnLabel: z.string().min(1),
  routeMode: z.enum(["validated-handoff", "local-fallback"]),
  runtimeAuthority: z.enum(["local-preview", "edge-worker"]),
  completion: z.object({
    status: z.enum(["pending", "completed", "failed"]),
    resultKind: z.enum(["preview", "validated-placeholder", "failed-placeholder"]),
    completedAtIso: z.string().datetime().nullable().default(null),
    objectiveCount: z.number().int().positive(),
    completedObjectives: z.number().int().nonnegative(),
    percentComplete: z.number().min(0).max(100),
  }),
});

export type MetaverseMissionRewardHookInput = z.infer<typeof metaverseMissionRewardHookInputSchema>;

export type MetaverseMissionRewardHookPort = {
  resolveRewardSummary(args: MetaverseMissionRewardHookInput): Promise<MetaverseMissionRewardHookResolved>;
};

export function parseMetaverseMissionRewardHookInput(input: unknown): MetaverseMissionRewardHookInput {
  return metaverseMissionRewardHookInputSchema.parse(input);
}

export function parseMetaverseMissionRewardHookResolved(input: unknown): MetaverseMissionRewardHookResolved {
  return metaverseMissionRewardHookResolvedSchema.parse(input);
}
