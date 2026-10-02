import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BrokenLinkPairStat = {
  referrerPath: string;
  notFoundRoute: string;
  sampled: number;
  estimated: number;
  lastSeenTs: string;
};

export type BrokenLinkTopStat = {
  key: string;
  sampled: number;
  estimated: number;
};

export type BrokenLinkSummary = {
  sinceIso: string;
  internalHosts: string[];
  sampledTotal: number;
  estimatedTotal: number;
  pairs: BrokenLinkPairStat[];
  topReferrers: BrokenLinkTopStat[];
  topTargets: BrokenLinkTopStat[];
  /**
   * Estimated/sample counts of *all* not_found routes in this query window (top N), keyed by route.
   * Useful to detect when the referrer itself is frequently 404'ing.
   */
  routeStatsByPath: Record<string, { sampled: number; estimated: number }>;
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

function aggregateTop(map: Map<string, { sampled: number; estimated: number }>, limit: number) {
  const list = Array.from(map.entries()).map(([key, stat]) => ({
    key,
    sampled: stat.sampled,
    estimated: stat.estimated,
  }));
  list.sort((a, b) => b.estimated - a.estimated || b.sampled - a.sampled);
  return list.slice(0, limit);
}

export async function getNotFoundBrokenLinkSummary(options: {
  nowMs?: number;
  sinceHours?: number;
  limit?: number;
  internalHosts: string[];
}) {
  const nowMs = options.nowMs ?? Date.now();
  const sinceHours = Number.isFinite(options.sinceHours) ? Math.max(1, Math.min(24 * 14, Math.floor(options.sinceHours!))) : 24;
  const limit = Number.isFinite(options.limit) ? Math.max(50, Math.min(2000, Math.floor(options.limit!))) : 1000;
  const sinceIso = toIso(nowMs - sinceHours * 60 * 60 * 1000);

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("ops_events")
    .select("ts, route, sample_rate, meta")
    .eq("kind", "not_found")
    .gte("ts", sinceIso)
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[ops/not_found] failed to query not_found for broken links", { message: error.message });
  }

  const rows = ((data ?? []) as OpsEventRow[]).filter(Boolean);

  const pairMap = new Map<string, { sampled: number; estimated: number; lastSeenTs: string; ref: string; route: string }>();
  const referrerMap = new Map<string, { sampled: number; estimated: number }>();
  const targetMap = new Map<string, { sampled: number; estimated: number }>();
  const routeMapAll = new Map<string, { sampled: number; estimated: number }>();

  let sampledTotal = 0;
  let estimatedTotal = 0;

  for (const row of rows) {
    const route = safeString(row.route);
    const meta = row.meta;
    const refHost = safeString(meta?.refererHost);
    const refPath = safeString(meta?.refererPath);

    if (!route || !route.startsWith("/")) continue;

    // Always track route-level counts (not filtered by internal referrer)
    {
      const sr = sampleRateOrOne(row.sample_rate);
      const entry = routeMapAll.get(route) ?? { sampled: 0, estimated: 0 };
      entry.sampled += 1;
      entry.estimated += sr;
      routeMapAll.set(route, entry);
    }

    if (!refHost || !refPath || !refPath.startsWith("/")) continue;
    if (!isInternalHost(refHost, options.internalHosts)) continue;

    const sr = sampleRateOrOne(row.sample_rate);

    sampledTotal += 1;
    estimatedTotal += sr;

    const key = `${refPath} -> ${route}`;
    const existing = pairMap.get(key);
    if (!existing) {
      pairMap.set(key, { sampled: 1, estimated: sr, lastSeenTs: row.ts, ref: refPath, route });
    } else {
      existing.sampled += 1;
      existing.estimated += sr;
      if (row.ts > existing.lastSeenTs) existing.lastSeenTs = row.ts;
    }

    const refEntry = referrerMap.get(refPath) ?? { sampled: 0, estimated: 0 };
    refEntry.sampled += 1;
    refEntry.estimated += sr;
    referrerMap.set(refPath, refEntry);

    const targetEntry = targetMap.get(route) ?? { sampled: 0, estimated: 0 };
    targetEntry.sampled += 1;
    targetEntry.estimated += sr;
    targetMap.set(route, targetEntry);
  }

  const pairs: BrokenLinkPairStat[] = Array.from(pairMap.values())
    .map((value) => ({
      referrerPath: value.ref,
      notFoundRoute: value.route,
      sampled: value.sampled,
      estimated: value.estimated,
      lastSeenTs: value.lastSeenTs,
    }))
    .sort((a, b) => b.estimated - a.estimated || b.sampled - a.sampled || (b.lastSeenTs > a.lastSeenTs ? 1 : -1));

  const summary: BrokenLinkSummary = {
    sinceIso,
    internalHosts: options.internalHosts,
    sampledTotal,
    estimatedTotal,
    pairs: pairs.slice(0, 200),
    topReferrers: aggregateTop(referrerMap, 20),
    topTargets: aggregateTop(targetMap, 20),
    routeStatsByPath: (() => {
      // Keep top 500 routes by estimated to limit payload size.
      const list = aggregateTop(routeMapAll, 500);
      const obj: Record<string, { sampled: number; estimated: number }> = {};
      for (const item of list) {
        obj[item.key] = { sampled: item.sampled, estimated: item.estimated };
      }
      return obj;
    })(),
  };

  return summary;
}
