export const dynamic = "force-dynamic";

import Link from "next/link";

import type { MatchingPatternItem } from "./MatchingPatternsDialog";
import BrokenLinksTableClient from "./BrokenLinksTableClient";

import OpsAccessDenied from "../OpsAccessDenied";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routes } from "@/lib/standards/routes";
import { CANONICAL_HOST, SHORT_HOST } from "@/lib/http/siteConfig";
import { getNotFoundSpikeSummary, type NotFoundSpikeRouteStat } from "@/lib/ops/notFoundSpike";
import { getNotFoundBrokenLinkSummary } from "@/lib/ops/notFoundBrokenLinks";
import { getNotFoundBrokenLinkImpactSummary } from "@/lib/ops/notFoundBrokenLinksImpact";
import { recommendBrokenLinkFix } from "@/lib/ops/brokenLinkRecommendation";
import { findMatchingPageRoutePatterns } from "@/lib/ops/pageRouteMatcher";
import { PAGE_ROUTE_PATTERNS } from "@/lib/generated/pageRouteInventory";

type OpsEventRow = {
  id: string;
  ts: string;
  route: string | null;
  request_id: string | null;
  sample_rate: number | null;
  meta: Record<string, unknown> | null;
};

function toIso(ms: number) {
  return new Date(ms).toISOString();
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hostAliases(host: string) {
  const trimmed = host.trim().toLowerCase();
  const set = new Set<string>();
  if (trimmed) set.add(trimmed);
  if (trimmed.startsWith("www.")) set.add(trimmed.slice(4));
  return Array.from(set);
}

function getInternalHosts() {
  return Array.from(new Set([...hostAliases(CANONICAL_HOST), ...hostAliases(SHORT_HOST)].filter(Boolean)));
}

function kindLabel(kind: string) {
  switch (kind) {
    case "fix_link":
      return "링크 수정";
    case "add_redirect_alias":
      return "리다이렉트 추가";
    case "create_page":
      return "페이지 추가";
    case "investigate_existing_route":
      return "기존 라우트 조사";
    default:
      return kind;
  }
}

function normalizeRoutePath(route: string) {
  if (!route) return "/";
  const stripped = route.split(/[?#]/, 1)[0] || "/";
  if (stripped !== "/" && stripped.endsWith("/")) return stripped.replace(/\/+$/, "");
  return stripped;
}

function isExactStaticRoute(route: string) {
  const normalized = normalizeRoutePath(route);
  return PAGE_ROUTE_PATTERNS.some(
    (p) => p.patternPath === normalized && p.segments.every((s) => s.kind === "literal"),
  );
}

type AliasCollisionStatus = "safe" | "warn" | "conflict";

type AliasCollision = {
  status: AliasCollisionStatus;
  label: string;
  matches: MatchingPatternItem[];
};

function aliasCollisionForPath(path: string): AliasCollision {
  const normalized = normalizeRoutePath(path);

  if (isExactStaticRoute(normalized)) {
    return { status: "conflict", label: "⚠️ conflict", matches: [] };
  }

  const matches = findMatchingPageRoutePatterns(normalized, 3).map((m) => ({
    patternPath: m.patternPath,
    fileHint: patternFileHint(m.patternPath),
  }));
  if (matches.length > 0) {
    return { status: "warn", label: "⚠️ warn", matches };
  }

  return { status: "safe", label: "✅ safe", matches: [] };
}

function patternFileHint(patternPath: string) {
  const normalized = normalizeRoutePath(patternPath);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "app/page.tsx";

  const mapped = parts.map((seg) => {
    if (seg.startsWith(":")) {
      if (seg.endsWith("*")) return `[...${seg.slice(1, -1)}]`;
      return `[${seg.slice(1)}]`;
    }
    return seg;
  });

  return `app/${mapped.join("/")}/page.tsx`;
}

function summarizeTopRoutes(rows: OpsEventRow[]): NotFoundSpikeRouteStat[] {
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
  return list.slice(0, 12);
}

export default async function OpsNotFoundPage() {
  const { user } = await requireUser(routes.page.dashboard.opsNotFound());
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath={routes.page.dashboard.opsNotFound()} />;
  }

  const client = createSupabaseAdminClient();
  const sinceIso = toIso(Date.now() - 24 * 60 * 60 * 1000);
  const internalHosts = getInternalHosts();

  const [{ data, error }, spike, brokenLinks, impactSummary] = await Promise.all([
    client
      .from("ops_events")
      .select("id, ts, route, request_id, sample_rate, meta")
      .eq("kind", "not_found")
      .gte("ts", sinceIso)
      .order("ts", { ascending: false })
      .limit(1000),
    getNotFoundSpikeSummary({ canonicalHost: CANONICAL_HOST }),
    getNotFoundBrokenLinkSummary({ sinceHours: 24, limit: 2000, internalHosts }),
    getNotFoundBrokenLinkImpactSummary({ internalHosts, recentMinutes: 60, baselineHours: 24, limit: 3500 }),
  ]);

  const rows = (data ?? []) as OpsEventRow[];
  const topRoutes = summarizeTopRoutes(rows);
  const recent = rows.slice(0, 20);

  const internalRefSamples = recent
    .map((row) => {
      const refHost = safeString(row.meta?.refererHost);
      const refPath = safeString(row.meta?.refererPath);
      if (!refHost || !refPath) return null;
      const refHostNorm = refHost.toLowerCase();
      if (!internalHosts.includes(refHostNorm)) return null;
      return { id: row.id, ts: row.ts, route: row.route ?? "unknown", refPath };
    })
    .filter(Boolean) as Array<{ id: string; ts: string; route: string; refPath: string }>;

  const pairRows = brokenLinks.pairs.map((pair) => {
    const rec = recommendBrokenLinkFix({
      referrerPath: pair.referrerPath,
      notFoundRoute: pair.notFoundRoute,
      estimated: pair.estimated,
      routeStatsByPath: brokenLinks.routeStatsByPath,
    });

    const best = rec.suggestedTargets?.[0] ?? (rec.routeExists ? "(exists)" : "—");
    const bestFrom = !rec.referrerRouteExists ? (rec.suggestedReferrers?.[0] ?? null) : null;

    const aliasCandidates: Array<{
      reason: "target" | "referrer";
      from: string;
      to: string;
      collision: AliasCollision;
    }> = [];

    if (rec.kind === "add_redirect_alias" && rec.suggestedTargets?.[0] && !rec.routeExists) {
      const to = rec.suggestedTargets[0];
      aliasCandidates.push({
        reason: "target",
        from: pair.notFoundRoute,
        to,
        collision: aliasCollisionForPath(pair.notFoundRoute),
      });
    }

    if (bestFrom) {
      aliasCandidates.push({
        reason: "referrer",
        from: pair.referrerPath,
        to: bestFrom,
        collision: aliasCollisionForPath(pair.referrerPath),
      });
    }

    const referrer404Warn = (rec.referrerNotFoundEstimated ?? 0) >= 10 ? (rec.referrerNotFoundEstimated as number) : null;

    const key = `${pair.referrerPath} -> ${pair.notFoundRoute}`;
    const effect = impactSummary.impactsByKey[key] ?? {
      recentPerHour: 0,
      baselinePerHour: 0,
      deltaPct: 0,
      trend: "flat" as const,
    };

    return {
      key,
      referrerPath: pair.referrerPath,
      referrerExists: rec.referrerRouteExists,
      notFoundRoute: pair.notFoundRoute,
      estimated: pair.estimated,
      sampled: pair.sampled,
      lastSeenTs: pair.lastSeenTs,
      recommendation: {
        kindLabel: kindLabel(rec.kind),
        best,
        bestFrom,
        referrer404Warn,
      },
      effect,
      aliasCandidates,
    };
  });

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8" data-page-marker="ops-not-found">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">운영 · 404 모니터링</p>
          <h1 className="text-2xl font-semibold">Not Found (404) 모니터링</h1>
          <p className="text-sm text-slate-500">Worker에서 샘플링해서 ops_events(kind=not_found)에 기록된 데이터입니다.</p>
        </div>
        <Link
          href={routes.page.dashboard.ops()}
          className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          Ops 대시보드
        </Link>
      </header>

      {error ? (
        <div className="dashboard-ops-card rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">ops_events 조회 실패: {error.message}</div>
      ) : null}

      {spike.isSpike ? (
        <section className="dashboard-ops-card rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-rose-800">⚠️ 404 급증 감지</h2>
              <p className="mt-1 text-sm text-rose-700">최근 {spike.windowMinutes}분(샘플 기준) App 경로에서 404가 급증했습니다.</p>
            </div>
            <div className="text-right text-sm text-rose-700">
              <p>
                estimated: <span className="font-semibold">{spike.estimatedAppTotal}</span> / threshold{" "}
                <span className="font-semibold">{spike.thresholdEstimated}</span>
              </p>
              <p className="text-xs text-rose-600">(추정치는 sample_rate를 합산한 값)</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="dashboard-ops-card rounded-md border border-rose-200 bg-white p-3">
              <p className="text-xs text-slate-500">Top App route (estimated)</p>
              <p className="mt-1 break-all font-semibold text-slate-800">{spike.topAppRoutes[0]?.route ?? "unknown"}</p>
              <p className="text-sm text-slate-700">{spike.topAppRoutes[0]?.estimated ?? 0} (sampled {spike.topAppRoutes[0]?.sampled ?? 0})</p>
              {spike.internalReferrerEstimated > 0 ? (
                <p className="mt-2 text-xs text-slate-600">내부 referrer 샘플 추정 {spike.internalReferrerEstimated}건</p>
              ) : null}
            </div>
            <div className="dashboard-ops-card rounded-md border border-rose-200 bg-white p-3">
              <p className="text-xs text-slate-500">Last spike record</p>
              <p className="mt-1 text-sm text-slate-700">{spike.lastSpikeAt ? new Date(spike.lastSpikeAt).toLocaleString() : "—"}</p>
              <p className="text-xs text-slate-500">cooldown: {spike.cooldownMinutes}분 · reason: {spike.spikeReason ?? "—"}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">최근 {spike.windowMinutes}분 요약</h2>
          <p className="mt-1 text-sm text-slate-600">
            App 404 estimated {spike.estimatedAppTotal} (sampled {spike.sampledAppTotal}) · threshold {spike.thresholdEstimated}
          </p>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Top 404 routes (최근 24시간)</h2>
          <p className="text-sm text-slate-500">sampled/estimated 기준</p>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2">route</th>
                  <th className="py-2 text-right">sampled</th>
                  <th className="py-2 text-right">estimated</th>
                </tr>
              </thead>
              <tbody>
                {topRoutes.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={3}>
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  topRoutes.map((row) => (
                    <tr key={row.route} className="dashboard-ops-row border-t border-slate-100">
                      <td className="max-w-[18rem] break-all py-2 font-mono text-xs text-slate-700">{row.route}</td>
                      <td className="py-2 text-right text-slate-700">{row.sampled}</td>
                      <td className="py-2 text-right font-semibold text-slate-900">{row.estimated}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">최근 샘플 (최대 20)</h2>
          <p className="text-sm text-slate-500">내부 referrer가 있으면 깨진 링크 가능성</p>
          <div className="mt-3 space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">최근 샘플이 없습니다.</p>
            ) : (
              recent.map((row) => {
                const host = safeString(row.meta?.host);
                const method = safeString(row.meta?.method);
                const refHost = safeString(row.meta?.refererHost);
                const refPath = safeString(row.meta?.refererPath);
                return (
                  <div key={row.id} className="dashboard-ops-row rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">{new Date(row.ts).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">sample_rate: {row.sample_rate ?? "-"}</p>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-slate-800">{row.route ?? "unknown"}</p>
                    <p className="mt-1 break-words text-xs text-slate-600">{method ?? "GET"} · {host ?? "host?"} · requestId: {row.request_id ?? "-"}</p>
                    {refHost && refPath ? (
                      <p className="mt-1 break-all text-xs text-slate-600">referer: {refHost}{refPath}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">깨진 링크 후보</h2>
            <p className="text-sm text-slate-500">내부 referrer(우리 도메인)에서 발생한 404를 referrer → 404 route로 묶은 리스트입니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="dashboard-ops-card rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">최근 24시간 내부 referrer 404</p>
            <p className="mt-1 text-sm text-slate-700">
              sampled <span className="font-semibold">{brokenLinks.sampledTotal}</span> · estimated{" "}
              <span className="font-semibold">{brokenLinks.estimatedTotal}</span>
            </p>
            <p className="mt-2 break-words text-xs text-slate-500">internal hosts: {brokenLinks.internalHosts.join(", ")}</p>
          </div>
          <div className="dashboard-ops-card rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Top referrer</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-800">{brokenLinks.topReferrers[0]?.key ?? "—"}</p>
            <p className="mt-1 text-sm text-slate-700">estimated {brokenLinks.topReferrers[0]?.estimated ?? 0}</p>
          </div>
          <div className="dashboard-ops-card rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Top 404 target</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-800">{brokenLinks.topTargets[0]?.key ?? "—"}</p>
            <p className="mt-1 text-sm text-slate-700">estimated {brokenLinks.topTargets[0]?.estimated ?? 0}</p>
          </div>
        </div>

        <BrokenLinksTableClient
          rows={pairRows}
          csvUrl={`${routes.api.ops.notFoundBrokenLinks()}?format=csv&hours=24`}
          bundleUrl={`${routes.api.ops.notFoundBrokenLinksBundle()}?format=md&hours=24&pairs=15`}
          workQueueApiUrl={routes.api.ops.notFoundWorkQueue()}
          workQueuePageUrl={routes.page.dashboard.opsWorkQueue()}
          effectTotals={{
            recentMinutes: impactSummary.recentMinutes,
            baselineHours: impactSummary.baselineHours,
            recentEstimatedPerHour: impactSummary.totals.estimatedRecentPerHour,
            baselineEstimatedPerHour: impactSummary.totals.estimatedBaselinePerHour,
            deltaPct: impactSummary.totals.deltaPct,
          }}
          defaultHours={24}
        />

        <div className="dashboard-ops-card mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-semibold">로컬에서 빠르게 찾는 방법</p>
          <p className="mt-1 text-xs text-slate-500">아래처럼 상위 404 route를 git grep으로 찾아 링크가 어디서 생성되는지 추적하세요.</p>
          <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-xs">{`git grep -n "${brokenLinks.pairs[0]?.notFoundRoute ?? "/your/path"}" app components lib
# referrer 페이지도 같이 찾기
git grep -n "${brokenLinks.pairs[0]?.referrerPath ?? "/your/referrer"}" app components lib`}</pre>
        </div>
      </section>

      {internalRefSamples.length > 0 ? (
        <section className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">내부 referrer 샘플</h2>
          <p className="text-sm text-slate-500">대부분 깨진 링크/리다이렉트 누락입니다.</p>
          <div className="mt-3 space-y-2">
            {internalRefSamples.slice(0, 10).map((sample) => (
              <div key={sample.id} className="dashboard-ops-row rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{new Date(sample.ts).toLocaleString()}</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-800">{sample.route}</p>
                <p className="mt-1 break-all text-xs text-slate-600">from: {sample.refPath}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
