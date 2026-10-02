import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StorageBadge = "ok" | "warn" | "danger" | "unknown";

export type CostSnapshot = {
  totalBytes: number | null;
  last30dBytes: number | null;
  capacityBytes: number | null;
  status: StorageBadge;
  warningPct: number;
  dangerPct: number;
};

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveCapacity() {
  const capacityEnv = process.env.OPS_STORAGE_CAPACITY_BYTES;
  const capacity = capacityEnv ? Number(capacityEnv) : null;
  return Number.isFinite(capacity) && capacity! > 0 ? Number(capacity) : null;
}

function resolveStatus(totalBytes: number | null, capacityBytes: number | null, warnPct: number, dangerPct: number): StorageBadge {
  if (!capacityBytes || !totalBytes) return "unknown";
  const ratio = (totalBytes / capacityBytes) * 100;
  if (ratio >= dangerPct) return "danger";
  if (ratio >= warnPct) return "warn";
  return "ok";
}

async function fetchAggsum({ since }: { since?: string | null }) {
  const client = createSupabaseAdminClient();
  let query = client.from("board_files").select("bytes_sum:bytes.sum()", { head: false }).limit(1);
  if (since) {
    query = query.gte("created_at", since);
  }
  const { data, error } = await query.single();
  if (error) throw error;
  const bytesSum = (data as { bytes_sum: number | null } | null)?.bytes_sum ?? null;
  return bytesSum ? Number(bytesSum) : 0;
}

export async function getCostSnapshot(): Promise<CostSnapshot> {
  const warnPct = parseNumber(process.env.OPS_STORAGE_WARN_PCT, 70);
  const dangerPct = parseNumber(process.env.OPS_STORAGE_DANGER_PCT, 90);
  const capacityBytes = resolveCapacity();

  try {
    const totalBytes = await fetchAggsum({ since: null });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last30dBytes = await fetchAggsum({ since });
    const status = resolveStatus(totalBytes, capacityBytes, warnPct, dangerPct);

    return { totalBytes, last30dBytes, capacityBytes, status, warningPct: warnPct, dangerPct };
  } catch (error) {
    console.warn("[ops] failed to compute cost snapshot", error);
    return { totalBytes: null, last30dBytes: null, capacityBytes, status: "unknown", warningPct: warnPct, dangerPct };
  }
}
