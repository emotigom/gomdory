import { z } from "zod";

export const metaverseAssetScopeSchema = z.enum(["world-hub", "mission-room"]);

export type MetaverseAssetScope = z.infer<typeof metaverseAssetScopeSchema>;

export const metaverseAssetKindSchema = z.enum([
  "scene-bundle",
  "scene-preview-image",
  "texture-sheet",
  "mission-briefing",
  "ambient-audio",
  "data",
]);

export type MetaverseAssetKind = z.infer<typeof metaverseAssetKindSchema>;

export const worldHubAssetRoleSchema = z.enum([
  "hub-scene",
  "hub-preview-image",
  "portal-preview-image",
  "kiosk-surface",
  "ambient-audio",
]);

export type WorldHubAssetRole = z.infer<typeof worldHubAssetRoleSchema>;

export const missionRoomAssetRoleSchema = z.enum([
  "mission-scene",
  "mission-preview-image",
  "mission-briefing",
  "ambient-audio",
]);

export type MissionRoomAssetRole = z.infer<typeof missionRoomAssetRoleSchema>;

const assetVersionFieldsSchema = z.object({
  version: z.string().min(1).nullable().default(null),
  cacheKey: z.string().min(1).nullable().default(null),
});

const assetMetadataFieldsSchema = z.object({
  contentType: z.string().min(1).nullable().default(null),
  bytes: z.number().int().nonnegative().nullable().default(null),
  integrity: z.string().min(1).nullable().default(null),
});

const worldHubAssetReferenceBaseSchema = z.object({
  assetId: z.string().min(1),
  label: z.string().min(1),
  kind: metaverseAssetKindSchema,
  href: z.string().min(1),
});

const missionRoomAssetReferenceBaseSchema = z.object({
  assetId: z.string().min(1),
  label: z.string().min(1),
  kind: metaverseAssetKindSchema,
  href: z.string().min(1),
});

export const worldHubAssetReferenceSchema = worldHubAssetReferenceBaseSchema
  .extend({
    role: worldHubAssetRoleSchema,
  })
  .merge(assetVersionFieldsSchema)
  .merge(assetMetadataFieldsSchema);

export type WorldHubAssetReference = z.infer<typeof worldHubAssetReferenceSchema>;

export const missionRoomAssetReferenceSchema = missionRoomAssetReferenceBaseSchema
  .extend({
    role: missionRoomAssetRoleSchema,
  })
  .merge(assetVersionFieldsSchema)
  .merge(assetMetadataFieldsSchema);

export type MissionRoomAssetReference = z.infer<typeof missionRoomAssetReferenceSchema>;

const assetManifestBaseSchema = z.object({
  version: z.literal(1),
  manifestVersion: z.string().min(1),
  runtimeId: z.string().min(1),
});

export const worldHubAssetManifestSchema = assetManifestBaseSchema.extend({
  scope: z.literal("world-hub"),
  assets: z.array(worldHubAssetReferenceSchema).readonly(),
});

export type WorldHubAssetManifest = z.infer<typeof worldHubAssetManifestSchema>;

export const missionRoomAssetManifestSchema = assetManifestBaseSchema.extend({
  scope: z.literal("mission-room"),
  assets: z.array(missionRoomAssetReferenceSchema).readonly(),
});

export type MissionRoomAssetManifest = z.infer<typeof missionRoomAssetManifestSchema>;

export const assetAvailabilitySchema = z.enum(["ready", "unavailable"]);

export type AssetAvailability = z.infer<typeof assetAvailabilitySchema>;

export const assetManifestSourceKindSchema = z.enum(["local-manifest", "r2-manifest"]);

export type AssetManifestSourceKind = z.infer<typeof assetManifestSourceKindSchema>;

export const assetManifestFallbackReasonSchema = z.enum([
  "local-preview-mode",
  "missing-manifest",
  "invalid-payload",
  "unavailable-manifest",
  "unavailable-reference",
]);

export type AssetManifestFallbackReason = z.infer<typeof assetManifestFallbackReasonSchema>;

export const assetSourceDiagnosticsSchema = z.object({
  scope: metaverseAssetScopeSchema,
  runtimeId: z.string().min(1),
  deliveryMode: z.enum(["local-preview", "r2-manifest"]),
  baseUrl: z.string().min(1).nullable().default(null),
  manifestVersion: z.string().min(1).nullable().default(null),
  assetCount: z.number().int().nonnegative(),
  readyAssetCount: z.number().int().nonnegative(),
  unavailableAssetCount: z.number().int().nonnegative(),
});

export type AssetSourceDiagnostics = z.infer<typeof assetSourceDiagnosticsSchema>;

const resolvedAssetDescriptorBaseSchema = z.object({
  assetId: z.string().min(1),
  label: z.string().min(1),
  kind: metaverseAssetKindSchema,
  href: z.string().min(1).nullable().default(null),
  availability: assetAvailabilitySchema,
  contentType: z.string().min(1).nullable().default(null),
  bytes: z.number().int().nonnegative().nullable().default(null),
  integrity: z.string().min(1).nullable().default(null),
  version: z.string().min(1).nullable().default(null),
  cacheKey: z.string().min(1).nullable().default(null),
});

export const worldHubResolvedAssetDescriptorSchema = resolvedAssetDescriptorBaseSchema.extend({
  role: worldHubAssetRoleSchema,
});

export type WorldHubResolvedAssetDescriptor = z.infer<typeof worldHubResolvedAssetDescriptorSchema>;

export const missionRoomResolvedAssetDescriptorSchema = resolvedAssetDescriptorBaseSchema.extend({
  role: missionRoomAssetRoleSchema,
});

export type MissionRoomResolvedAssetDescriptor = z.infer<typeof missionRoomResolvedAssetDescriptorSchema>;

const assetSourceBaseSchema = z.object({
  kind: assetManifestSourceKindSchema,
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  fallbackReason: assetManifestFallbackReasonSchema.nullable().default(null),
  diagnostics: assetSourceDiagnosticsSchema,
});

export const worldHubResolvedAssetSetSchema = z.object({
  scope: z.literal("world-hub"),
  runtimeId: z.string().min(1),
  manifestVersion: z.string().min(1),
  descriptors: z.array(worldHubResolvedAssetDescriptorSchema).readonly(),
  source: assetSourceBaseSchema.extend({
    diagnostics: assetSourceDiagnosticsSchema.extend({
      scope: z.literal("world-hub"),
    }),
  }),
  loadedAtIso: z.string().datetime(),
});

export type WorldHubResolvedAssetSet = z.infer<typeof worldHubResolvedAssetSetSchema>;

export const missionRoomResolvedAssetSetSchema = z.object({
  scope: z.literal("mission-room"),
  runtimeId: z.string().min(1),
  manifestVersion: z.string().min(1),
  descriptors: z.array(missionRoomResolvedAssetDescriptorSchema).readonly(),
  source: assetSourceBaseSchema.extend({
    diagnostics: assetSourceDiagnosticsSchema.extend({
      scope: z.literal("mission-room"),
    }),
  }),
  loadedAtIso: z.string().datetime(),
});

export type MissionRoomResolvedAssetSet = z.infer<typeof missionRoomResolvedAssetSetSchema>;

export type MetaverseAssetDeliveryPort = {
  loadWorldHubAssets(args: { worldId: string }): Promise<WorldHubResolvedAssetSet>;
  loadMissionRoomAssets(args: { missionId: string }): Promise<MissionRoomResolvedAssetSet>;
};

export function parseWorldHubAssetManifest(input: unknown): WorldHubAssetManifest {
  return worldHubAssetManifestSchema.parse(input);
}

export function parseMissionRoomAssetManifest(input: unknown): MissionRoomAssetManifest {
  return missionRoomAssetManifestSchema.parse(input);
}

export function parseWorldHubResolvedAssetSet(input: unknown): WorldHubResolvedAssetSet {
  return worldHubResolvedAssetSetSchema.parse(input);
}

export function parseMissionRoomResolvedAssetSet(input: unknown): MissionRoomResolvedAssetSet {
  return missionRoomResolvedAssetSetSchema.parse(input);
}
