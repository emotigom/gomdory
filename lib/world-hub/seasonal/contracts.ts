import { z } from "zod";

import { configFallbackReasonSchema } from "@/lib/world-hub/config/sourceContracts";

export const worldHubSeasonalDecorationStatusSchema = z.enum(["active", "upcoming", "inactive", "fallback_preview"]);

export type WorldHubSeasonalDecorationStatus = z.infer<typeof worldHubSeasonalDecorationStatusSchema>;

export const worldHubSeasonalDecorationContextSchema = z.object({
  classId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1),
  sessionId: z.string().min(1).nullable().default(null),
});

export type WorldHubSeasonalDecorationContext = z.infer<typeof worldHubSeasonalDecorationContextSchema>;

export const worldHubSeasonalDecorationZoneSchema = z.enum(["home-lane", "central-plaza", "academy-lodge-approach"]);

export type WorldHubSeasonalDecorationZone = z.infer<typeof worldHubSeasonalDecorationZoneSchema>;

export const worldHubSeasonalDecorationSuppressionTargetSchema = z.enum([
  "home-lane-celebration",
  "class-celebration",
  "session-celebration",
]);

export type WorldHubSeasonalDecorationSuppressionTarget = z.infer<typeof worldHubSeasonalDecorationSuppressionTargetSchema>;

export const worldHubSeasonalDecorationLayerSchema = z.object({
  layerId: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  zone: worldHubSeasonalDecorationZoneSchema,
  accent: z.string().min(1),
  status: worldHubSeasonalDecorationStatusSchema,
  active: z.boolean(),
  suppresses: z.array(worldHubSeasonalDecorationSuppressionTargetSchema).readonly().default([]),
  activeFromIso: z.string().datetime().nullable().default(null),
  activeUntilIso: z.string().datetime().nullable().default(null),
});

export type WorldHubSeasonalDecorationLayer = z.infer<typeof worldHubSeasonalDecorationLayerSchema>;

export const worldHubSeasonalDecorationSummarySchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  chips: z.array(z.string().min(1)).readonly(),
});

export type WorldHubSeasonalDecorationSummary = z.infer<typeof worldHubSeasonalDecorationSummarySchema>;

export const worldHubSeasonalDecorationDiagnosticsSchema = z.object({
  adapterKind: z.enum(["local-preview-snapshot", "backend-managed"]),
  resolvedAtIso: z.string().datetime(),
  matchedScheduleId: z.string().min(1).nullable().default(null),
  activeLayerCount: z.number().int().nonnegative(),
});

export type WorldHubSeasonalDecorationDiagnostics = z.infer<typeof worldHubSeasonalDecorationDiagnosticsSchema>;

export const worldHubSeasonalDecorationSourceSchema = z.object({
  kind: z.enum(["local-preview-snapshot", "backend-managed"]),
  label: z.string().min(1),
  detail: z.string().min(1),
  fallbackReason: configFallbackReasonSchema.nullable().default(null),
});

export type WorldHubSeasonalDecorationSource = z.infer<typeof worldHubSeasonalDecorationSourceSchema>;

export const worldHubResolvedSeasonalDecorationStateSchema = z.object({
  status: worldHubSeasonalDecorationStatusSchema,
  summary: worldHubSeasonalDecorationSummarySchema,
  layers: z.array(worldHubSeasonalDecorationLayerSchema).readonly(),
  source: worldHubSeasonalDecorationSourceSchema,
  diagnostics: worldHubSeasonalDecorationDiagnosticsSchema,
});

export type WorldHubResolvedSeasonalDecorationState = z.infer<typeof worldHubResolvedSeasonalDecorationStateSchema>;

export type WorldHubSeasonalDecorationPort = {
  resolveState(args: {
    context: WorldHubSeasonalDecorationContext;
  }): Promise<WorldHubResolvedSeasonalDecorationState>;
};

export function parseWorldHubSeasonalDecorationContext(input: unknown): WorldHubSeasonalDecorationContext {
  return worldHubSeasonalDecorationContextSchema.parse(input);
}

export function parseWorldHubResolvedSeasonalDecorationState(input: unknown): WorldHubResolvedSeasonalDecorationState {
  return worldHubResolvedSeasonalDecorationStateSchema.parse(input);
}
