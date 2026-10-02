import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPlanQuotaBytes } from "@/lib/billing/plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoragePlanLimits, StorageUsageSnapshot } from "@/lib/types/storage";

export function getStoragePlanLimits(
  env: Record<string, string | undefined> = process.env,
): StoragePlanLimits {
  const { freeQuotaBytes, proQuotaBytes } = getPlanQuotaBytes(env);
  return {
    freeLimitBytes: freeQuotaBytes,
    proLimitBytes: proQuotaBytes,
  };
}

type StorageUsageRow = {
  bytes_used: number | null;
  bytes_saved_estimate: number | null;
  updated_at: string | null;
};

export async function getStorageUsageSnapshot(
  userId: string,
  deps?: { createSupabaseClient?: () => SupabaseClient },
): Promise<StorageUsageSnapshot> {
  const supabase = deps?.createSupabaseClient?.() ?? createSupabaseServerClient();

  let usageRow: StorageUsageRow | null = null;

  try {
    const { data, error } = await supabase
      .from("storage_usage")
      .select("bytes_used, bytes_saved_estimate, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      usageRow = {
        bytes_used: typeof data.bytes_used === "number" ? data.bytes_used : 0,
        bytes_saved_estimate:
          typeof data.bytes_saved_estimate === "number" ? data.bytes_saved_estimate : 0,
        updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
      };
    }
  } catch (error) {
    console.warn("[storage_usage] failed to read storage_usage table", error);
  }

  if (usageRow) {
    return {
      usedBytes: usageRow.bytes_used ?? 0,
      savedBytes: usageRow.bytes_saved_estimate ?? 0,
      updatedAt: usageRow.updated_at ?? null,
    };
  }

  try {
    const { data, error } = await supabase
      .from("files")
      .select("size_bytes")
      .eq("owner_id", userId)
      .eq("status", "ready");

    if (error) {
      throw error;
    }

    const usedBytes = (data ?? []).reduce((sum, file) => {
      const size = typeof file.size_bytes === "number" ? file.size_bytes : 0;
      return sum + size;
    }, 0);

    return {
      usedBytes,
      savedBytes: 0,
      updatedAt: null,
    };
  } catch (error) {
    console.warn("[storage_usage] failed to sum files", error);
  }

  return { usedBytes: 0, savedBytes: 0, updatedAt: null };
}
