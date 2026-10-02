import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type EduFeatureFlagsRow = {
  user_id: string;
  webllm_enabled: boolean | null;
  netsaver_enabled: boolean | null;
  netsaver_mode: "lease_only" | "auto" | null;
  netsaver_p2p_tier: "meta" | "small_shards" | "wasm" | null;
  max_bytes: number | null;
  updated_at: string | null;
};

export type ApiNetsaverMode = "leaseOnly" | "auto";
export type ApiNetsaverP2pTier = "meta" | "smallShards" | "wasm";

export const mapDbModeToApiMode = (mode: EduFeatureFlagsRow["netsaver_mode"]): ApiNetsaverMode =>
  mode === "auto" ? "auto" : "leaseOnly";

export const mapApiModeToDbMode = (mode: ApiNetsaverMode): "lease_only" | "auto" =>
  mode === "auto" ? "auto" : "lease_only";

export const mapDbTierToApiTier = (tier: EduFeatureFlagsRow["netsaver_p2p_tier"]): ApiNetsaverP2pTier => {
  if (tier === "wasm") return "wasm";
  if (tier === "small_shards") return "smallShards";
  return "meta";
};

export const mapApiTierToDbTier = (tier: ApiNetsaverP2pTier): "meta" | "small_shards" | "wasm" => {
  if (tier === "smallShards") return "small_shards";
  return tier;
};

export function parseApiNetsaverMode(value: unknown): ApiNetsaverMode | null {
  if (value === "auto") return "auto";
  if (value === "leaseOnly" || value === "lease_only") return "leaseOnly";
  return null;
}

export function parseApiNetsaverP2pTier(value: unknown): ApiNetsaverP2pTier | null {
  if (value === "meta" || value === "wasm") return value;
  if (value === "smallShards" || value === "small_shards") return "smallShards";
  return null;
}

export function toEduFeatureFlagsDto(row: EduFeatureFlagsRow) {
  return {
    userId: row.user_id,
    webllmEnabled: row.webllm_enabled !== false,
    netsaverEnabled: row.netsaver_enabled === true,
    netsaverMode: mapDbModeToApiMode(row.netsaver_mode),
    netsaverP2pTier: mapDbTierToApiTier(row.netsaver_p2p_tier),
    maxBytes: Number.isFinite(row.max_bytes) ? Math.max(1, Math.floor(row.max_bytes as number)) : 1,
    updatedAt: row.updated_at,
  };
}

type LegacyUpdatePayload = {
  user_id?: unknown;
  webllm_enabled?: unknown;
  netsaver_enabled?: unknown;
  netsaver_mode?: unknown;
  netsaver_p2p_tier?: unknown;
  max_bytes?: unknown;
  userId?: unknown;
  webllmEnabled?: unknown;
  netsaverEnabled?: unknown;
  netsaverMode?: unknown;
  netsaverP2pTier?: unknown;
  maxBytes?: unknown;
};

export function normalizeEduFlagsUpdatePayload(raw: unknown) {
  const payload = raw as LegacyUpdatePayload | null;
  if (!payload || typeof payload !== "object") return null;

  const rawUserId = payload.userId ?? payload.user_id;
  const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";
  const webllmEnabled = payload.webllmEnabled ?? payload.webllm_enabled;
  const netsaverEnabled = payload.netsaverEnabled ?? payload.netsaver_enabled;
  const netsaverMode = parseApiNetsaverMode(payload.netsaverMode ?? payload.netsaver_mode);
  const rawTier = payload.netsaverP2pTier ?? payload.netsaver_p2p_tier;
  const maxBytes = payload.maxBytes ?? payload.max_bytes;

  if (typeof webllmEnabled !== "boolean" || typeof netsaverEnabled !== "boolean" || !netsaverMode) return null;
  if (rawTier !== null && parseApiNetsaverP2pTier(rawTier) === null) return null;
  if (typeof maxBytes !== "number" || !Number.isInteger(maxBytes) || maxBytes <= 0) return null;

  const parsedTier = parseApiNetsaverP2pTier(rawTier ?? "meta") ?? "meta";

  return {
    userId,
    webllmEnabled,
    netsaverEnabled,
    netsaverMode,
    netsaverP2pTier: netsaverEnabled && rawTier === null ? "meta" : parsedTier,
    maxBytes,
  };
}

export async function getEduFeatureFlagsByUserId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  return admin
    .from("edu_feature_flags")
    .select("user_id, webllm_enabled, netsaver_enabled, netsaver_mode, netsaver_p2p_tier, max_bytes, updated_at")
    .eq("user_id", userId)
    .maybeSingle<EduFeatureFlagsRow>();
}

export async function upsertEduFeatureFlagsByUserId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  payload: {
    webllmEnabled: boolean;
    netsaverEnabled: boolean;
    netsaverMode: "lease_only" | "auto";
    netsaverP2pTier: "meta" | "small_shards" | "wasm";
    maxBytes: number;
  },
) {
  return admin
    .from("edu_feature_flags")
    .upsert(
      {
        user_id: userId,
        webllm_enabled: payload.webllmEnabled,
        netsaver_enabled: payload.netsaverEnabled,
        netsaver_mode: payload.netsaverMode,
        netsaver_p2p_tier: payload.netsaverEnabled ? payload.netsaverP2pTier : null,
        max_bytes: payload.maxBytes,
      } as never,
      { onConflict: "user_id" },
    )
    .select("user_id, webllm_enabled, netsaver_enabled, netsaver_mode, netsaver_p2p_tier, max_bytes, updated_at")
    .single<EduFeatureFlagsRow>();
}
