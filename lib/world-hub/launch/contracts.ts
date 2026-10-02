import { z } from "zod";

const metaverseLaunchControlStateVersion = 1 as const;

export const metaverseLaunchControlResolutionSchema = z.enum(["resolved", "fallback"]);

export type MetaverseLaunchControlResolution = z.infer<typeof metaverseLaunchControlResolutionSchema>;

export const metaverseLaunchControlFallbackReasonSchema = z.enum([
  "preview-mode",
  "classroom-context-unavailable",
  "snapshot-missing",
  "invalid-snapshot",
]);

export type MetaverseLaunchControlFallbackReason = z.infer<typeof metaverseLaunchControlFallbackReasonSchema>;

export const metaverseLaunchControlScopeSchema = z.object({
  classId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1),
  sessionId: z.string().min(1).nullable().default(null),
  context: z.enum(["classroom", "preview"]),
});

export type MetaverseLaunchControlScope = z.infer<typeof metaverseLaunchControlScopeSchema>;

export const metaverseLaunchControlDecisionCodeSchema = z.enum([
  "allowed",
  "preview-allowed",
  "teacher-blocked",
  "scheduled-closed",
  "mission-allowed",
  "mission-blocked",
  "inherit-world-state",
]);

export type MetaverseLaunchControlDecisionCode = z.infer<typeof metaverseLaunchControlDecisionCodeSchema>;

export const metaverseLaunchControlDecisionSchema = z.object({
  status: z.enum(["allowed", "blocked"]),
  code: metaverseLaunchControlDecisionCodeSchema,
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
});

export type MetaverseLaunchControlDecision = z.infer<typeof metaverseLaunchControlDecisionSchema>;

export const metaverseMissionLaunchOverrideModeSchema = z.enum(["allowed", "blocked"]);

export type MetaverseMissionLaunchOverrideMode = z.infer<typeof metaverseMissionLaunchOverrideModeSchema>;

export const metaverseMissionLaunchOverrideSchema = z.object({
  missionId: z.string().min(1),
  mode: metaverseMissionLaunchOverrideModeSchema,
  decision: metaverseLaunchControlDecisionSchema,
  detail: z.string().min(1).nullable().default(null),
});

export type MetaverseMissionLaunchOverride = z.infer<typeof metaverseMissionLaunchOverrideSchema>;

export const metaverseLaunchControlPreviewSchema = z.object({
  mode: z.enum(["local-snapshot", "fallback-open-preview"]),
  fallback: z.enum(["allow-world-hub", "inherit-mission-availability"]),
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
});

export type MetaverseLaunchControlPreview = z.infer<typeof metaverseLaunchControlPreviewSchema>;

export const metaverseLaunchControlMetadataSchema = z.object({
  state: z.enum(["open", "blocked", "mission-overrides"]),
  stateLabel: z.string().min(1),
  summary: z.string().min(1),
  updatedAtIso: z.string().datetime(),
  effectiveFromIso: z.string().datetime().nullable().default(null),
  expiresAtIso: z.string().datetime().nullable().default(null),
});

export type MetaverseLaunchControlMetadata = z.infer<typeof metaverseLaunchControlMetadataSchema>;

export const metaverseLaunchControlSourceSchema = z.object({
  kind: z.enum(["local-preview-snapshot", "teacher-managed-config"]),
  label: z.string().min(1),
  detail: z.string().min(1),
  fallbackReason: metaverseLaunchControlFallbackReasonSchema.nullable().default(null),
});

export type MetaverseLaunchControlSource = z.infer<typeof metaverseLaunchControlSourceSchema>;

export const metaverseLaunchControlDiagnosticsSchema = z.object({
  adapterKind: z.enum(["local-preview-snapshot", "local-preview-fallback", "teacher-managed-config"]),
  resolution: metaverseLaunchControlResolutionSchema,
  scopeContext: z.enum(["classroom", "preview"]),
  snapshotKey: z.string().min(1).nullable().default(null),
  missionOverrideCount: z.number().int().nonnegative(),
  evaluatedAtIso: z.string().datetime(),
  summary: z.string().min(1),
});

export type MetaverseLaunchControlDiagnostics = z.infer<typeof metaverseLaunchControlDiagnosticsSchema>;

export const metaverseResolvedLaunchControlStateSchema = z.object({
  version: z.literal(metaverseLaunchControlStateVersion),
  scope: metaverseLaunchControlScopeSchema,
  source: metaverseLaunchControlSourceSchema,
  resolution: metaverseLaunchControlResolutionSchema,
  preview: metaverseLaunchControlPreviewSchema,
  metadata: metaverseLaunchControlMetadataSchema,
  hubEntry: metaverseLaunchControlDecisionSchema,
  missionOverrides: z.array(metaverseMissionLaunchOverrideSchema).readonly(),
  diagnostics: metaverseLaunchControlDiagnosticsSchema,
});

export type MetaverseResolvedLaunchControlState = z.infer<typeof metaverseResolvedLaunchControlStateSchema>;

export const metaverseLaunchControlContextSchema = z.object({
  classId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1),
  sessionId: z.string().min(1).nullable().default(null),
});

export type MetaverseLaunchControlContext = z.infer<typeof metaverseLaunchControlContextSchema>;

export type MetaverseLaunchControlPort = {
  resolveLaunchControls(args?: {
    context?: MetaverseLaunchControlContext | null;
  }): Promise<MetaverseResolvedLaunchControlState>;
};

export function parseMetaverseLaunchControlContext(input: unknown): MetaverseLaunchControlContext {
  return metaverseLaunchControlContextSchema.parse(input);
}

export function parseMetaverseResolvedLaunchControlState(input: unknown): MetaverseResolvedLaunchControlState {
  return metaverseResolvedLaunchControlStateSchema.parse(input);
}
