import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import { isStorageQuotaExceeded } from "@/lib/storage/quota";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StorageUploadQuotaSnapshot = {
  usedBytes: number;
  quotaBytes: number;
  attemptBytes: number;
};

export class StorageUploadQuotaExceededError extends Error {
  readonly code = "quota_exceeded";
  readonly snapshot: StorageUploadQuotaSnapshot;

  constructor(snapshot: StorageUploadQuotaSnapshot) {
    super("quota_exceeded");
    this.name = "StorageUploadQuotaExceededError";
    this.snapshot = snapshot;
  }
}

function parseUsedBytes(value: unknown): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("invalid_storage_usage");
  }
  return parsed;
}

export async function assertStorageUploadAllowed(
  ownerId: string,
  attemptBytes: number,
  deps?: { supabaseClient?: SupabaseClient },
): Promise<StorageUploadQuotaSnapshot> {
  if (!Number.isSafeInteger(attemptBytes) || attemptBytes <= 0) {
    throw new Error("invalid_size");
  }

  const supabase = deps?.supabaseClient ?? createSupabaseAdminClient();
  const [usageResult, effectiveQuota] = await Promise.all([
    supabase
      .from("storage_usage")
      .select("bytes_used")
      .eq("user_id", ownerId)
      .maybeSingle<{ bytes_used: number | string | null }>(),
    resolveEffectiveStorageQuota(ownerId, { supabaseClient: supabase }),
  ]);

  if (usageResult.error) {
    throw new Error(usageResult.error.message);
  }

  const snapshot = {
    usedBytes: parseUsedBytes(usageResult.data?.bytes_used ?? 0),
    quotaBytes: effectiveQuota.quotaBytes,
    attemptBytes,
  };

  if (isStorageQuotaExceeded(snapshot)) {
    throw new StorageUploadQuotaExceededError(snapshot);
  }

  return snapshot;
}
