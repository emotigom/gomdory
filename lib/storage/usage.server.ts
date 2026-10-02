import "server-only";

import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listObjectsV2 } from "@/lib/r2/client";
import { computeOptimizedBytesSaved } from "@/lib/storage/usage";

export type StorageUsageSnapshot = {
  day: string;
  r2Bytes: number;
  dbBytes: number;
  filesCount: number;
  optimizedBytesSaved: number;
};

const DEFAULT_MAX_KEYS = 1000;

function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeUsageRow(row: {
  day: string | null;
  r2_bytes: number | string | null;
  db_bytes: number | string | null;
  files_count: number | string | null;
  optimized_bytes_saved: number | string | null;
}): StorageUsageSnapshot {
  return {
    day: row.day ?? "",
    r2Bytes: parseNumber(row.r2_bytes),
    dbBytes: parseNumber(row.db_bytes),
    filesCount: parseNumber(row.files_count),
    optimizedBytesSaved: parseNumber(row.optimized_bytes_saved),
  };
}

export async function fetchStorageQuotaBytes(ownerId: string): Promise<number> {
  return (await resolveEffectiveStorageQuota(ownerId)).quotaBytes;
}

export async function fetchStorageUsageDaily(ownerId: string, days = 7): Promise<StorageUsageSnapshot[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("storage_usage_daily")
    .select("day, r2_bytes, db_bytes, files_count, optimized_bytes_saved")
    .eq("owner_id", ownerId)
    .order("day", { ascending: false })
    .limit(days);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(normalizeUsageRow);
}

async function listR2Prefix(prefix: string): Promise<{ bytes: number; count: number }> {
  let bytes = 0;
  let count = 0;
  let continuationToken: string | undefined;
  let isTruncated = true;

  while (isTruncated) {
    const response = await listObjectsV2({
      prefix,
      continuationToken,
      maxKeys: DEFAULT_MAX_KEYS,
    });
    bytes += response.bytes;
    count += response.count;
    isTruncated = response.isTruncated;
    continuationToken = response.nextContinuationToken;

    if (!isTruncated || !continuationToken) {
      break;
    }
  }

  return { bytes, count };
}

async function getR2UsageSummary(ownerId: string): Promise<{ bytes: number; filesCount: number }> {
  const userPrefix = `u/${ownerId}/`;
  const summary = await listR2Prefix(userPrefix);
  return { bytes: summary.bytes, filesCount: summary.count };
}

async function getDbUsageBytes(ownerId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const [{ data: files, error: filesError }, { data: boardFiles, error: boardFilesError }] = await Promise.all([
    supabase
      .from("files")
      .select("stored_bytes, size_bytes, status")
      .eq("owner_id", ownerId)
      .eq("status", "ready"),
    supabase
      .from("board_files")
      .select("optimized_bytes, bytes, deleted_at")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
  ]);

  if (filesError) {
    throw new Error(filesError.message);
  }
  if (boardFilesError) {
    throw new Error(boardFilesError.message);
  }

  const filesBytes = (files ?? []).reduce((sum, file) => {
    const size = parseNumber(file.stored_bytes ?? file.size_bytes ?? 0);
    return sum + size;
  }, 0);

  const boardBytes = (boardFiles ?? []).reduce((sum, file) => {
    const size = parseNumber(file.optimized_bytes ?? file.bytes ?? 0);
    return sum + size;
  }, 0);

  return filesBytes + boardBytes;
}

export async function getFilesCount(ownerId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const [{ count: filesCount, error: filesError }, { count: boardCount, error: boardError }] = await Promise.all([
    supabase
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("status", "ready"),
    supabase
      .from("board_files")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
  ]);

  if (filesError) {
    throw new Error(filesError.message);
  }
  if (boardError) {
    throw new Error(boardError.message);
  }

  return parseNumber(filesCount) + parseNumber(boardCount);
}

export async function computeSavings(ownerId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const [{ data: files, error: filesError }, { data: boardFiles, error: boardFilesError }] = await Promise.all([
    supabase
      .from("files")
      .select("original_size_bytes, optimized_size_bytes, optimized, is_optimized, original_bytes, stored_bytes, size_bytes, status")
      .eq("owner_id", ownerId)
      .eq("status", "ready"),
    supabase
      .from("board_files")
      .select("bytes_saved, original_bytes, optimized_bytes, deleted_at")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
  ]);

  if (filesError) {
    throw new Error(filesError.message);
  }
  if (boardFilesError) {
    throw new Error(boardFilesError.message);
  }

  const fileSavings = computeOptimizedBytesSaved(
    (files ?? []).map((file) => {
      const original = parseNumber(file.original_size_bytes ?? file.original_bytes ?? file.size_bytes ?? 0);
      const optimized = parseNumber(file.optimized_size_bytes ?? file.stored_bytes ?? file.size_bytes ?? 0);
      const optimizedFlag = Boolean(file.is_optimized ?? file.optimized);
      return {
        originalBytes: original,
        optimizedBytes: optimized,
        optimized: optimizedFlag,
      };
    }),
  );

  const boardSavings = (boardFiles ?? []).reduce((total, file) => {
    const savedExplicit = parseNumber(file.bytes_saved ?? 0);
    if (savedExplicit > 0) {
      return total + savedExplicit;
    }
    const original = parseNumber(file.original_bytes ?? 0);
    const optimized = parseNumber(file.optimized_bytes ?? 0);
    if (original <= 0 || optimized <= 0) return total;
    return total + Math.max(0, original - optimized);
  }, 0);

  return fileSavings + boardSavings;
}

export async function refreshStorageUsageDaily(ownerId: string, now = new Date()): Promise<StorageUsageSnapshot> {
  const supabase = createSupabaseAdminClient();
  const day = toDayString(now);

  let r2Bytes = 0;
  let r2Files = 0;

  try {
    const r2Summary = await getR2UsageSummary(ownerId);
    r2Bytes = r2Summary.bytes;
    r2Files = r2Summary.filesCount;
  } catch (error) {
    console.warn("[storage_usage_daily] failed to list r2 usage", error);
  }

  const [dbBytes, filesCount, optimizedBytesSaved] = await Promise.all([
    getDbUsageBytes(ownerId),
    getFilesCount(ownerId),
    computeSavings(ownerId),
  ]);

  const resolvedFilesCount = r2Files > 0 ? r2Files : filesCount;
  const resolvedBytes = r2Bytes > 0 ? r2Bytes : dbBytes;

  const { data, error } = await supabase
    .from("storage_usage_daily")
    .upsert(
      {
        owner_id: ownerId,
        day,
        r2_bytes: resolvedBytes,
        db_bytes: 0,
        files_count: resolvedFilesCount,
        optimized_bytes_saved: optimizedBytesSaved,
        created_at: now.toISOString(),
      },
      { onConflict: "owner_id,day" },
    )
    .select("day, r2_bytes, db_bytes, files_count, optimized_bytes_saved")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeUsageRow(data);
}

export function buildTrendRange(
  now: Date,
  snapshots: StorageUsageSnapshot[],
  days = 7,
): StorageUsageSnapshot[] {
  const byDay = new Map(snapshots.map((entry) => [entry.day, entry]));
  const range: StorageUsageSnapshot[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const day = toDayString(date);
    const snapshot = byDay.get(day);
    range.push(
      snapshot ?? {
        day,
        r2Bytes: 0,
        dbBytes: 0,
        filesCount: 0,
        optimizedBytesSaved: 0,
      },
    );
  }

  return range;
}
