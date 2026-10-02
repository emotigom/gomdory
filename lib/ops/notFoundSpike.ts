import "server-only";

import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotFoundSpikeRouteStat = {
  route: string;
  sampled: number;
  estimated: number;
};

export type NotFoundSpikeSummary = {
  windowMinutes: number;
  windowStartIso: string;
  sampledTotal: number;
  estimatedTotal: number;
  sampledAppTotal: number;
  estimatedAppTotal: number;
  topRoutes: NotFoundSpikeRouteStat[];
  topAppRoutes: NotFoundSpikeRouteStat[];
  internalReferrerSampled: number;
  internalReferrerEstimated: number;
  isSpike: boolean;
  spikeReason: string | null;
  thresholdEstimated: number;
  topRouteThresholdEstimated: number;
  cooldownMinutes: number;
  lastSpikeAt: string | null;
};

type OpsEventRow = {
  ts: string;
  route: string | null;
  kind: string | null;
  sample_rate: number | null;
  meta: Record<string, unknown> | null;
};

const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/auth",
  "/invite",
  "/offline",
  "/demo",
  "/s/",
  "/c/",
  "/e/",
  "/r/",
  "/x/",
  "/k/",
];

function readIntEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function isAppRoute(path: string) {
  return APP_ROUTE_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) return path.startsWith(prefix);
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

function toIso(ms: number) {
  return new Date(ms).toISOString();
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function aggregateRoutes(rows: OpsEventRow[]) {
  const map = new Map<string, { sampled: number; estimated: number }>();

  for (const row of rows) {
    const route = row.route ?? "unknown";
    const sampleRate = Number.isFinite(row.sample_rate) && (row.sample_rate ?? 0) > 0 ? row.sample_rate! : 1;

    const entry = map.get(route) ?? { sampled: 0, estimated: 0 };
    entry.sampled += 1;
    entry.estimated += sampleRate;
    map.set(route, entry);
  }

  const list = Array.from(map.entries()).map(([route, stat]) => ({
    route,
    sampled: stat.sampled,
    estimated: stat.estimated,
  }));

  list.sort((a, b) => b.estimated - a.estimated || b.sampled - a.sampled);

  return list;
}

async function fetchNotFoundRows({
  windowStartIso,
  limit,
}: {
  windowStartIso: string;
  limit: number;
}) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("ops_events")
    .select("ts, route, kind, sample_rate, meta")
    .eq("kind", "not_found")
    .gte("ts", windowStartIso)
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[ops/not_found] failed to query ops_events", { message: error.message });
    return [] as OpsEventRow[];
  }

  return (data ?? []) as OpsEventRow[];
}

async function fetchLastSpikeTs() {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("ops_events")
    .select("ts")
    .eq("kind", "not_found_spike")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[ops/not_found] failed to query last spike", { message: error.message });
    return null;
  }

  return data?.ts ?? null;
}

export async function getNotFoundSpikeSummary(options?: {
  nowMs?: number;
  canonicalHost?: string;
}) {
  const nowMs = options?.nowMs ?? Date.now();
  const windowMinutes = readIntEnv("OPS_NOT_FOUND_SPIKE_WINDOW_MINUTES", 10);
  const thresholdEstimated = readIntEnv("OPS_NOT_FOUND_SPIKE_THRESHOLD_ESTIMATED", 200);
  const topRouteThresholdEstimated = readIntEnv("OPS_NOT_FOUND_SPIKE_TOP_ROUTE_THRESHOLD_ESTIMATED", 120);
  const cooldownMinutes = readIntEnv("OPS_NOT_FOUND_SPIKE_COOLDOWN_MINUTES", 30);
  const queryLimit = readIntEnv("OPS_NOT_FOUND_SPIKE_QUERY_LIMIT", 1000);

  const windowStartMs = nowMs - windowMinutes * 60 * 1000;
  const windowStartIso = toIso(windowStartMs);

  const rows = await fetchNotFoundRows({ windowStartIso, limit: queryLimit });

  const sampledTotal = rows.length;
  const estimatedTotal = rows.reduce((acc, row) => {
    const sampleRate = Number.isFinite(row.sample_rate) && (row.sample_rate ?? 0) > 0 ? row.sample_rate! : 1;
    return acc + sampleRate;
  }, 0);

  const appRows = rows.filter((row) => isAppRoute(row.route ?? ""));
  const sampledAppTotal = appRows.length;
  const estimatedAppTotal = appRows.reduce((acc, row) => {
    const sampleRate = Number.isFinite(row.sample_rate) && (row.sample_rate ?? 0) > 0 ? row.sample_rate! : 1;
    return acc + sampleRate;
  }, 0);

  const topRoutes = aggregateRoutes(rows).slice(0, 10);
  const topAppRoutes = aggregateRoutes(appRows).slice(0, 10);

  const canonicalHost = options?.canonicalHost ? options.canonicalHost.trim() : null;
  let internalReferrerSampled = 0;
  let internalReferrerEstimated = 0;

  if (canonicalHost) {
    for (const row of rows) {
      const meta = row.meta;
      const refHost = safeString(meta?.refererHost);
      if (!refHost) continue;
      if (refHost !== canonicalHost) continue;
      internalReferrerSampled += 1;
      const sampleRate = Number.isFinite(row.sample_rate) && (row.sample_rate ?? 0) > 0 ? row.sample_rate! : 1;
      internalReferrerEstimated += sampleRate;
    }
  }

  const topAppEstimated = topAppRoutes[0]?.estimated ?? 0;
  let isSpike = false;
  let spikeReason: string | null = null;

  if (estimatedAppTotal >= thresholdEstimated) {
    isSpike = true;
    spikeReason = "estimated_app_total_over_threshold";
  } else if (topAppEstimated >= topRouteThresholdEstimated) {
    isSpike = true;
    spikeReason = "estimated_top_route_over_threshold";
  }

  const lastSpikeAt = await fetchLastSpikeTs();

  const cooldownActive = (() => {
    if (!lastSpikeAt) return false;
    const lastMs = Date.parse(lastSpikeAt);
    if (!Number.isFinite(lastMs)) return false;
    return nowMs - lastMs < cooldownMinutes * 60 * 1000;
  })();

  if (isSpike && !cooldownActive) {
    const topRoute = topAppRoutes[0]?.route ?? topRoutes[0]?.route ?? null;

    await recordOpsEvent(
      {
        level: "error",
        kind: "not_found_spike",
        request_id: crypto.randomUUID(),
        route: topRoute,
        status: 404,
        meta: {
          windowMinutes,
          thresholdEstimated,
          topRouteThresholdEstimated,
          estimatedAppTotal,
          sampledAppTotal,
          internalReferrerEstimated,
          internalReferrerSampled,
          topAppRoutes: topAppRoutes.slice(0, 5),
          spikeReason,
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 2 },
    );
  }

  const summary: NotFoundSpikeSummary = {
    windowMinutes,
    windowStartIso,
    sampledTotal,
    estimatedTotal,
    sampledAppTotal,
    estimatedAppTotal,
    topRoutes,
    topAppRoutes,
    internalReferrerSampled,
    internalReferrerEstimated,
    isSpike,
    spikeReason,
    thresholdEstimated,
    topRouteThresholdEstimated,
    cooldownMinutes,
    lastSpikeAt,
  };

  return summary;
}
