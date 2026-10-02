import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { CANONICAL_HOST, SHORT_HOST } from "@/lib/http/siteConfig";
import { recommendBrokenLinkFix } from "@/lib/ops/brokenLinkRecommendation";
import { getNotFoundBrokenLinkImpactSummary } from "@/lib/ops/notFoundBrokenLinksImpact";
import { getNotFoundBrokenLinkSummary, type BrokenLinkPairStat } from "@/lib/ops/notFoundBrokenLinks";

type PairParam = { r: string; t: string };

function parseIntParam(raw: string | null, fallback: number, min: number, max: number) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function hostAliases(host: string) {
  const trimmed = host.trim().toLowerCase();
  const set = new Set<string>();
  if (trimmed) set.add(trimmed);
  if (trimmed.startsWith("www.")) set.add(trimmed.slice(4));
  return Array.from(set);
}

function parsePairParams(params: string[]): PairParam[] {
  const parsed: PairParam[] = [];
  for (const raw of params) {
    try {
      const value = JSON.parse(raw) as PairParam;
      if (value && typeof value.r === "string" && typeof value.t === "string") {
        parsed.push({ r: value.r, t: value.t });
      }
    } catch {
      // ignore malformed pairs
    }
  }
  return parsed;
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function trendLabel(trend: "improving" | "worsening" | "new" | "flat") {
  switch (trend) {
    case "improving":
      return "↓개선";
    case "worsening":
      return "↑악화";
    case "new":
      return "NEW";
    default:
      return "—";
  }
}

function csvEscape(value: string) {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function toCsvQueue(options: {
  hours: number;
  recentMinutes: number;
  baselineHours: number;
  pairs: BrokenLinkPairStat[];
  routeStatsByPath?: Record<string, { sampled: number; estimated: number }>;
  impactByKey: Record<string, { recentPerHour: number; baselinePerHour: number; deltaPct: number; trend: string }>;
}) {
  const lines: string[] = [];
  lines.push(
    [
      "referrer_path",
      "not_found_route",
      "recommendation_kind",
      "recommended_target",
      "trend",
      "recent_per_hour",
      "baseline_per_hour",
      "delta_pct",
      "hours_window",
      "recent_minutes",
      "baseline_hours",
    ].join(","),
  );

  for (const pair of options.pairs) {
    const key = `${pair.referrerPath} -> ${pair.notFoundRoute}`;
    const impact = options.impactByKey[key] ?? {
      recentPerHour: 0,
      baselinePerHour: 0,
      deltaPct: 0,
      trend: "flat",
    };
    const rec = recommendBrokenLinkFix({
      referrerPath: pair.referrerPath,
      notFoundRoute: pair.notFoundRoute,
      estimated: pair.estimated,
      routeStatsByPath: options.routeStatsByPath,
    });
    const best = rec.suggestedTargets?.[0] ?? (rec.routeExists ? "(exists)" : "");
    lines.push(
      [
        csvEscape(pair.referrerPath),
        csvEscape(pair.notFoundRoute),
        csvEscape(rec.kind),
        csvEscape(best),
        csvEscape(impact.trend),
        impact.recentPerHour.toFixed(2),
        impact.baselinePerHour.toFixed(2),
        (impact.deltaPct * 100).toFixed(1),
        String(options.hours),
        String(options.recentMinutes),
        String(options.baselineHours),
      ].join(","),
    );
  }

  return lines.join("\n");
}

function toMarkdownQueue(options: {
  hours: number;
  recentMinutes: number;
  baselineHours: number;
  internalHosts: string[];
  pairs: BrokenLinkPairStat[];
  routeStatsByPath?: Record<string, { sampled: number; estimated: number }>;
  impactByKey: Record<string, { recentPerHour: number; baselinePerHour: number; deltaPct: number; trend: string }>;
}) {
  const nowIso = new Date().toISOString();
  const lines: string[] = [];
  lines.push("# Broken Links Work Queue");
  lines.push("");
  lines.push(`- Generated: ${nowIso}`);
  lines.push(`- Window: last ${options.hours} hours`);
  lines.push(`- Effect comparison: recent ${options.recentMinutes}m vs baseline ${options.baselineHours}h avg/h`);
  lines.push(`- Internal hosts: ${options.internalHosts.join(", ") || "—"}`);
  lines.push("");
  lines.push("| from (referrer) | to (404 route) | 추천 | effect | recent/h | baseline/h | delta |");
  lines.push("|---|---|---|---|---:|---:|---:|");

  for (const pair of options.pairs) {
    const key = `${pair.referrerPath} -> ${pair.notFoundRoute}`;
    const impact = options.impactByKey[key] ?? {
      recentPerHour: 0,
      baselinePerHour: 0,
      deltaPct: 0,
      trend: "flat",
    };
    const rec = recommendBrokenLinkFix({
      referrerPath: pair.referrerPath,
      notFoundRoute: pair.notFoundRoute,
      estimated: pair.estimated,
      routeStatsByPath: options.routeStatsByPath,
    });
    const best = rec.suggestedTargets?.[0] ?? (rec.routeExists ? "(exists)" : "—");
    lines.push(
      `| \`${pair.referrerPath}\` | \`${pair.notFoundRoute}\` | ${rec.kind} → \`${best}\` | ${trendLabel(impact.trend as "improving" | "worsening" | "new" | "flat")} | ${impact.recentPerHour.toFixed(1)} | ${impact.baselinePerHour.toFixed(1)} | ${formatPct(impact.deltaPct)} |`,
    );
  }

  lines.push("");
  lines.push("## Next actions");
  lines.push("1. Pick a pair with the biggest impact or worsening trend.");
  lines.push("2. Fix the referrer link or add a redirect alias.");
  lines.push("3. Deploy and verify the effect in /dashboard/ops/not-found.");
  lines.push("");
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const init = withNoStoreHeaders({});

  let email: string | null = null;
  try {
    const { user } = await requireUserApi();
    email = user.email ?? null;
  } catch {
    return jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401, undefined, init);
  }

  if (!isOpsAdmin(email)) {
    return jsonErrorWithRequestId("forbidden", "운영자 권한이 필요합니다.", requestId, 403, undefined, init);
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";
  const hours = parseIntParam(url.searchParams.get("hours"), 24, 1, 24 * 14);
  const limit = parseIntParam(url.searchParams.get("limit"), 3500, 50, 5000);
  const pairs = parseIntParam(url.searchParams.get("pairs"), 10, 1, 50);
  const recentMinutes = parseIntParam(url.searchParams.get("recentMinutes"), 60, 5, 24 * 60);
  const baselineHours = parseIntParam(url.searchParams.get("baselineHours"), 24, 1, 24 * 14);

  const internalHosts = Array.from(
    new Set([...hostAliases(CANONICAL_HOST), ...hostAliases(SHORT_HOST)].filter(Boolean)),
  );

  const pairParams = parsePairParams(url.searchParams.getAll("pair"));

  const summary = await getNotFoundBrokenLinkSummary({
    sinceHours: hours,
    limit,
    internalHosts,
  });

  const impactSummary = await getNotFoundBrokenLinkImpactSummary({
    internalHosts,
    recentMinutes,
    baselineHours,
    limit,
  });

  const selectedPairs: BrokenLinkPairStat[] =
    pairParams.length > 0
      ? pairParams
          .map((pair) =>
            summary.pairs.find(
              (item) => item.referrerPath === pair.r && item.notFoundRoute === pair.t,
            ) ?? { referrerPath: pair.r, notFoundRoute: pair.t, sampled: 0, estimated: 0, lastSeenTs: "" },
          )
      : summary.pairs.slice(0, pairs);

  const markdown = toMarkdownQueue({
    hours,
    recentMinutes: impactSummary.recentMinutes,
    baselineHours: impactSummary.baselineHours,
    internalHosts,
    pairs: selectedPairs,
    routeStatsByPath: summary.routeStatsByPath,
    impactByKey: impactSummary.impactsByKey,
  });

  if (format === "json") {
    return jsonOkWithRequestId(
      {
        summary,
        queue: {
          hours,
          recentMinutes: impactSummary.recentMinutes,
          baselineHours: impactSummary.baselineHours,
          pairs: selectedPairs,
        },
        markdown,
      },
      requestId,
      init,
    );
  }

  if (format === "csv") {
    const csv = toCsvQueue({
      hours,
      recentMinutes: impactSummary.recentMinutes,
      baselineHours: impactSummary.baselineHours,
      pairs: selectedPairs,
      routeStatsByPath: summary.routeStatsByPath,
      impactByKey: impactSummary.impactsByKey,
    });
    const headers = new Headers(init.headers);
    headers.set("x-request-id", requestId);
    headers.set("x-gom-request-id", requestId);
    headers.set("content-type", "text/csv; charset=utf-8");
    headers.set("content-disposition", "attachment; filename=\"ops-not-found-work-queue.csv\"");
    return new Response(csv, { status: 200, headers });
  }

  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);
  headers.set("content-type", "text/markdown; charset=utf-8");
  headers.set("content-disposition", "attachment; filename=\"ops-not-found-work-queue.md\"");

  return new Response(markdown, { status: 200, headers });
}
