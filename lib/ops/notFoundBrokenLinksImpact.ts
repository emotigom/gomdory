import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BrokenLinkImpactEffect = {
  recentPerHour: number;
  baselinePerHour: number;
  deltaPct: number;
  trend: "improving" | "worsening" | "new" | "flat";
};

export type BrokenLinkImpactSummary = {
  recentMinutes: number;
  baselineHours: number;
  totals: {
    estimatedRecentPerHour: number;
    estimatedBaselinePerHour: number;
    deltaPct: number;
  };
  impactsByKey: Record<string, BrokenLinkImpactEffect>;
};

type OpsEventRow = {
  ts: string;
  route: string | null;
  sample_rate: number | null;
  meta: Record<string, unknown> | null;
};

function toIso(ms: number) {
  return new Date(ms).toISOString();
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sampleRateOrOne(value: number | null | undefined) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : 1;
}

function isInternalHost(host: string, internalHosts: string[]) {
  const normalized = host.toLowerCase();
  return internalHosts.some((candidate) => candidate.toLowerCase() === normalized);
}

function computeEffect(recentPerHour: number, baselinePerHour: number): BrokenLinkImpactEffect {
  if (baselinePerHour <= 0) {
    if (recentPerHour <= 0) {
      return { recentPerHour, baselinePerHour, deltaPct: 0, trend: "flat" };
    }
    return { recentPerHour, baselinePerHour, deltaPct: 100, trend: "new" };
  }
  const deltaPct = ((recentPerHour - baselinePerHour) / baselinePerHour) * 100;
  const trend = recentPerHour === baselinePerHour ? "flat" : recentPerHour > baselinePerHour ? "worsening" : "improving";
  return { recentPerHour, baselinePerHour, deltaPct, trend };
}

export async function getNotFoundBrokenLinkImpactSummary(options: {
  nowMs?: number;
  recentMinutes?: number;
  baselineHours?: number;
  limit?: number;
  internalHosts: string[];
}): Promise<BrokenLinkImpactSummary> {
  const nowMs = options.nowMs ?? Date.now();
  const recentMinutes = Number.isFinite(options.recentMinutes)
    ? Math.max(5, Math.min(24 * 60, Math.floor(options.recentMinutes!)))
    : 60;
  const baselineHours = Number.isFinite(options.baselineHours)
    ? Math.max(1, Math.min(24 * 14, Math.floor(options.baselineHours!)))
    : 24;
  const limit = Number.isFinite(options.limit) ? Math.max(200, Math.min(5000, Math.floor(options.limit!))) : 2000;
  const sinceIso = toIso(nowMs - baselineHours * 60 * 60 * 1000);
  const recentSinceMs = nowMs - recentMinutes * 60 * 1000;
  const recentHours = recentMinutes / 60;

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("ops_events")
    .select("ts, route, sample_rate, meta")
    .eq("kind", "not_found")
    .gte("ts", sinceIso)
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[ops/not_found] failed to query not_found for broken link impact", { message: error.message });
  }

  const rows = ((data ?? []) as OpsEventRow[]).filter(Boolean);

  const pairMap = new Map<string, { recentEstimated: number; baselineEstimated: number }>();
  let recentEstimatedTotal = 0;
  let baselineEstimatedTotal = 0;

  for (const row of rows) {
    const route = safeString(row.route);
    const meta = row.meta;
    const refHost = safeString(meta?.refererHost);
    const refPath = safeString(meta?.refererPath);
    if (!route || !route.startsWith("/")) continue;
    if (!refHost || !refPath || !refPath.startsWith("/")) continue;
    if (!isInternalHost(refHost, options.internalHosts)) continue;

    const sr = sampleRateOrOne(row.sample_rate);
    const key = `${refPath} -> ${route}`;
    const entry = pairMap.get(key) ?? { recentEstimated: 0, baselineEstimated: 0 };
    entry.baselineEstimated += sr;
    baselineEstimatedTotal += sr;

    const tsMs = Date.parse(row.ts);
    if (Number.isFinite(tsMs) && tsMs >= recentSinceMs) {
      entry.recentEstimated += sr;
      recentEstimatedTotal += sr;
    }

    pairMap.set(key, entry);
  }

  const impactsByKey: Record<string, BrokenLinkImpactEffect> = {};
  for (const [key, entry] of pairMap.entries()) {
    const recentPerHour = recentHours > 0 ? entry.recentEstimated / recentHours : 0;
    const baselinePerHour = baselineHours > 0 ? entry.baselineEstimated / baselineHours : 0;
    impactsByKey[key] = computeEffect(recentPerHour, baselinePerHour);
  }

  const totalsEffect = computeEffect(
    recentHours > 0 ? recentEstimatedTotal / recentHours : 0,
    baselineHours > 0 ? baselineEstimatedTotal / baselineHours : 0,
  );

  return {
    recentMinutes,
    baselineHours,
    totals: {
      estimatedRecentPerHour: totalsEffect.recentPerHour,
      estimatedBaselinePerHour: totalsEffect.baselinePerHour,
      deltaPct: totalsEffect.deltaPct,
    },
    impactsByKey,
  };
}
