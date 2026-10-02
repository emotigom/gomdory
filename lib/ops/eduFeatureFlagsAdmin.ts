import { flagsFromRow, type EduFeatureFlagsRow } from "@/lib/edu/featureFlags";
import { mapDbModeToApiMode, mapDbTierToApiTier } from "@/lib/ops/eduFeatureFlagsStore";
import {
  getEduWebLLMEnableFlag,
} from "@/lib/edu/llm/webllmFeatureFlags";

export type OpsFeatureFlags = {
  webllmEnabled: boolean;
  netsaverEnabled: boolean;
  netsaverMode: "leaseOnly" | "auto";
  netsaverP2pTier: "meta" | "smallShards" | "wasm";
  maxBytes: number;
  updatedAt: string | null;
};

export type OpsFeatureFlagsGating = {
  effectiveWebllmEnabled: boolean;
  reasons: string[];
  gatingMode: "userOnly" | "pilotAllowlist" | "disabled";
  allowlistDecision: "allowed" | "blocked" | "notApplicable";
  userFlagsPresent: boolean;
  globalWebllmEnabled: boolean;
};

export function normalizeOpsFeatureFlags(row: EduFeatureFlagsRow | null, updatedAt: string | null): OpsFeatureFlags {
  const normalized = flagsFromRow(row);
  return {
    webllmEnabled: normalized.webllmEnabled,
    netsaverEnabled: normalized.netsaverEnabled,
    netsaverMode: mapDbModeToApiMode(normalized.netsaverMode),
    netsaverP2pTier: mapDbTierToApiTier(normalized.netsaverP2pTier),
    maxBytes: normalized.maxBytes,
    updatedAt,
  };
}

export function resolveOpsFeatureFlagGating(options: {
  userId: string;
  email?: string | null;
  featureFlags: OpsFeatureFlags;
  userFlagsPresent: boolean;
}): OpsFeatureFlagsGating {
  const globalWebllmEnabled = getEduWebLLMEnableFlag();
  const gatingMode = "userOnly" as const;

  const reasons: string[] = [];
  if (!globalWebllmEnabled) reasons.push("globalEnvDisabled");
  if (options.userFlagsPresent && options.featureFlags.webllmEnabled !== true) reasons.push("userWebllmDisabled");
  if (reasons.length === 0) reasons.push("enabled");

  return {
    effectiveWebllmEnabled:
      globalWebllmEnabled &&
      (!options.userFlagsPresent || options.featureFlags.webllmEnabled === true),
    reasons,
    gatingMode,
    allowlistDecision: "notApplicable",
    userFlagsPresent: options.userFlagsPresent,
    globalWebllmEnabled,
  };
}
