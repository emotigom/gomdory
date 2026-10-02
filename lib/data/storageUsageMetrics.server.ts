import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeStorageUsageMetrics, type StorageUsageMetrics } from "./storageUsageMetrics";

export async function fetchStorageUsageMetricsForOwner(ownerId: string): Promise<StorageUsageMetrics> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("files")
    .select("id, object_key, bytes_stored, size_bytes, bytes_original")
    .eq("owner_id", ownerId)
    .eq("status", "ready");

  if (error) {
    throw new Error(error.message);
  }

  const records = (data ?? []).map((row) => ({
    id: row.id,
    objectKey: row.object_key ?? null,
    bytesStored: row.bytes_stored ?? null,
    sizeBytes: row.size_bytes ?? null,
    bytesOriginal: row.bytes_original ?? null,
  }));

  return computeStorageUsageMetrics(records);
}
