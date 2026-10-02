export type EduNetSaverMode = "lease_only" | "auto";
export type EduNetSaverP2PTier = "meta" | "small_shards" | "wasm";

export type EduFeatureFlags = {
  webllmFeatureEnabled: boolean;
  webllmDownloadAllowed: boolean;
  webllmEnabled: boolean;
  netsaverEnabled: boolean;
  netsaverMode: EduNetSaverMode;
  netsaverP2pTier: EduNetSaverP2PTier;
  maxBytes: number;
  reason: string;
  reasons?: string[];
  gatingMode?: "user_only" | "pilot_allowlist" | "join_token" | "sample_lesson" | "disabled";
  allowlistDecision?: "allowed" | "blocked" | "not_applicable";
  userFlagsPresent?: boolean;
  errorKind?: "auth_error" | "env_missing" | "fetch_blocked" | "ok";
};

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export const EDU_FEATURE_FLAGS_DEFAULTS: EduFeatureFlags = {
  webllmFeatureEnabled: true,
  webllmDownloadAllowed: true,
  webllmEnabled: true,
  netsaverEnabled: false,
  netsaverMode: "lease_only",
  netsaverP2pTier: "meta",
  maxBytes: DEFAULT_MAX_BYTES,
  reason: "default",
};

const normalizeMode = (value: string | null | undefined): EduNetSaverMode => {
  if (value === "auto") return "auto";
  return "lease_only";
};

const normalizeTier = (value: string | null | undefined): EduNetSaverP2PTier => {
  if (value === "small_shards" || value === "wasm") return value;
  return "meta";
};

const normalizeMaxBytes = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_MAX_BYTES;
  return Math.max(1, Math.floor(value as number));
};

export const normalizeEduFeatureFlags = (
  value: Partial<EduFeatureFlags> | null | undefined,
  reason = "default",
): EduFeatureFlags => ({
  webllmFeatureEnabled: value?.webllmFeatureEnabled ?? value?.webllmEnabled ?? true,
  webllmDownloadAllowed: value?.webllmDownloadAllowed ?? true,
  webllmEnabled: value?.webllmFeatureEnabled ?? value?.webllmEnabled ?? true,
  netsaverEnabled: value?.netsaverEnabled === true,
  netsaverMode: normalizeMode(value?.netsaverMode),
  netsaverP2pTier: normalizeTier(value?.netsaverP2pTier),
  maxBytes: normalizeMaxBytes(value?.maxBytes),
  reason,
});

export type EduFeatureFlagsRow = {
  user_id: string;
  webllm_enabled: boolean | null;
  netsaver_enabled: boolean | null;
  netsaver_mode: string | null;
  netsaver_p2p_tier: string | null;
  max_bytes: number | null;
};

export const flagsFromRow = (row: EduFeatureFlagsRow | null): EduFeatureFlags => {
  if (!row) return { ...EDU_FEATURE_FLAGS_DEFAULTS, reason: "no_row" };

  return normalizeEduFeatureFlags(
    {
      webllmFeatureEnabled: row.webllm_enabled !== false,
      webllmDownloadAllowed: true,
      webllmEnabled: row.webllm_enabled !== false,
      netsaverEnabled: row.netsaver_enabled === true,
      netsaverMode: normalizeMode(row.netsaver_mode),
      netsaverP2pTier: normalizeTier(row.netsaver_p2p_tier),
      maxBytes: normalizeMaxBytes(row.max_bytes),
    },
    "allowlist",
  );
};
