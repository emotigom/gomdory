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
import { getNotFoundBrokenLinkSummary, type BrokenLinkPairStat } from "@/lib/ops/notFoundBrokenLinks";
import { recommendBrokenLinkFix } from "@/lib/ops/brokenLinkRecommendation";
import { doesPageRouteExist, findMatchingPageRoutePatterns } from "@/lib/ops/pageRouteMatcher";
import { PAGE_ROUTE_PATTERNS } from "@/lib/generated/pageRouteInventory";

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

function mdCodeBlock(label: string, lines: string[]) {
  const body = lines.filter(Boolean).join("\n");
  return [`### ${label}`, "```bash", body, "```"].join("\n");
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

function grepNeedlesForRoute(route: string) {
  const needles = new Set<string>();
  if (!route) return [];
  needles.add(route);

  // If the route contains masked segments like "/:id", grep the stable prefix too.
  const idx = route.indexOf("/:");
  if (idx > 0) {
    const prefix = route.slice(0, idx + 1); // keep trailing slash
    if (prefix.length >= 2) needles.add(prefix);
  }

  return Array.from(needles);
}

function isSafeForRedirectAliasTemplate(route: string) {
  // We only auto-generate templates for static paths. Masked segments (/:id) need manual handling.
  if (!route || !route.startsWith("/")) return false;
  if (route.includes("/:")) return false;
  if (route.includes("*")) return false;
  return true;
}

function normalizeRoutePath(route: string) {
  if (!route) return "/";
  const stripped = route.split(/[?#]/, 1)[0] || "/";
  if (stripped !== "/" && stripped.endsWith("/")) return stripped.replace(/\/+$/, "");
  return stripped;
}

type AliasCollision = {
  status: "safe" | "warn" | "conflict";
  detail: string;
  matchedPatterns?: Array<{ patternPath: string; fileHint: string }>;
};

function fileHintForPattern(segments: Array<{ kind: "literal" | "param" | "catchall"; value: string }>) {
  if (segments.length === 0) return "app/page.tsx";
  const parts = segments.map((seg) => {
    if (seg.kind === "literal") return seg.value;
    const name = (seg.value || "param").replace(/^:/, "").replace(/\*+$/, "") || "param";
    if (seg.kind === "catchall") return `[...${name}]`;
    return `[${name}]`;
  });
  return `app/${parts.join("/")}/page.tsx`;
}

function collisionStatusForAlias(fromRoute: string): AliasCollision {
  const normalized = normalizeRoutePath(fromRoute);

  // Exact static page already exists (highest risk): creating app/<path>/page.tsx would overwrite it.
  const exactStatic = PAGE_ROUTE_PATTERNS.some(
    (p) => p.patternPath === normalized && p.segments.every((s) => s.kind === "literal"),
  );
  if (exactStatic) {
    return {
      status: "conflict",
      detail: "이미 동일한 정적 페이지 라우트가 존재합니다. redirect alias 파일을 만들면 기존 기능을 덮어씁니다.",
    };
  }

  // If the path would be handled by an existing dynamic route (e.g. /[code]), adding a static redirect will override it.
  if (doesPageRouteExist(normalized)) {
    const matches = findMatchingPageRoutePatterns(normalized, 3);
    return {
      status: "warn",
      detail:
        "이 경로는 현재 빌드의 동적 라우트(예: /[code] 또는 /dashboard/boards/[boardId] 등)에 의해 처리될 수 있습니다. 정적 redirect alias를 추가하면 해당 경로를 덮어쓰게 되니, 의도한 호환인지 확인하세요.",
      matchedPatterns:
        matches.length > 0
          ? matches.map((m) => ({
              patternPath: m.patternPath,
              fileHint: fileHintForPattern(m.segments),
            }))
          : undefined,
    };
  }

  return { status: "safe", detail: "현재 빌드에 동일 라우트가 없습니다." };
}

function collisionLabel(c: AliasCollision) {
  switch (c.status) {
    case "safe":
      return "✅ 안전";
    case "warn":
      return "⚠️ 충돌 가능";
    case "conflict":
      return "⚠️ 충돌 가능";
    default:
      return c.status;
  }
}

function appPageFilePathForRoute(route: string) {

  const normalized = route === "/" ? "/" : route.replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "app/page.tsx";
  return `app/${parts.join("/")}/page.tsx`;
}

function redirectAliasTemplate(to: string) {
  return [
    `import { redirect } from "next/navigation";`,
    "",
    "export default function Page() {",
    `  redirect(\"${to}\");`,
    "}",
  ].join("\n");
}

function toMarkdownBundle(options: {
  hours: number;
  internalHosts: string[];
  topPairs: BrokenLinkPairStat[];
  sampledTotal: number;
  estimatedTotal: number;
  routeStatsByPath?: Record<string, { sampled: number; estimated: number }>;
}) {
  const nowIso = new Date().toISOString();
  const pairs = options.topPairs;
  const pairsWithRec = pairs.map((pair) => ({
    pair,
    rec: recommendBrokenLinkFix({
      referrerPath: pair.referrerPath,
      notFoundRoute: pair.notFoundRoute,
      estimated: pair.estimated,
      routeStatsByPath: options.routeStatsByPath,
    }),
  }));

  const uniqueTargets = Array.from(new Set(pairs.flatMap((p) => grepNeedlesForRoute(p.notFoundRoute)))).slice(0, 30);
  const uniqueReferrers = Array.from(new Set(pairs.flatMap((p) => grepNeedlesForRoute(p.referrerPath)))).slice(0, 30);

  const md: string[] = [];
  md.push(`# Broken Links Investigation Bundle`);
  md.push("");
  md.push(`- Generated: ${nowIso}`);
  md.push(`- Window: last ${options.hours} hours`);
  md.push(`- Internal hosts: ${options.internalHosts.join(", ") || "—"}`);
  md.push(`- Totals (internal referrer 404): sampled ${options.sampledTotal} · estimated ${options.estimatedTotal}`);
  md.push("");

  md.push("## Top pairs (referrer → 404 route)");
  md.push("");
  if (pairsWithRec.length === 0) {
    md.push("No internal broken-link pairs in the selected window.");
  } else {
    md.push("| from (referrer) | from exists | from 404 est | to (404 route) | to exists | best match | 추천 | est | sampled | last seen |" );
    md.push("|---|:---:|---:|---|:---:|---|---|---:|---:|---|" );
    for (const row of pairsWithRec) {
      const best = row.rec.suggestedTargets?.[0] ?? (row.rec.routeExists ? "(exists)" : "—");
      const fromExists = row.rec.referrerRouteExists ? "✅" : "❌";
      const toExists = row.rec.routeExists ? "✅" : "❌";
      const from404 = Number.isFinite(row.rec.referrerNotFoundEstimated) ? (row.rec.referrerNotFoundEstimated as number) : 0;
      const to404 = Number.isFinite(row.rec.targetNotFoundEstimated) ? (row.rec.targetNotFoundEstimated as number) : row.pair.estimated;
      md.push(
        `| \`${row.pair.referrerPath}\` | ${fromExists} | ${from404} | \`${row.pair.notFoundRoute}\` | ${toExists} | \`${best}\` | ${kindLabel(row.rec.kind)} | ${to404} | ${row.pair.sampled} | ${row.pair.lastSeenTs} |`,
      );
    }
  }
  md.push("");

  if (pairsWithRec.length > 0) {
    md.push("## Recommendation notes");
    md.push("");
    for (const item of pairsWithRec.slice(0, 10)) {
      md.push(`### ${item.pair.referrerPath} → ${item.pair.notFoundRoute}`);
      md.push(`- 추천: **${kindLabel(item.rec.kind)}**`);
      md.push(`- 요약: ${item.rec.summary}`);
      if (Number.isFinite(item.rec.referrerNotFoundEstimated)) {
        md.push(`- from 404 est: ${item.rec.referrerNotFoundEstimated}`);
      }
      if (Number.isFinite(item.rec.targetNotFoundEstimated)) {
        md.push(`- to 404 est: ${item.rec.targetNotFoundEstimated}`);
      }
      if (item.rec.suggestedTargets && item.rec.suggestedTargets.length > 0) {
        md.push(`- 후보: ${item.rec.suggestedTargets.map((x) => `\`${x}\``).join(", ")}`);
      }
      if (item.rec.notes && item.rec.notes.length > 0) {
        md.push("- 참고:");
        for (const note of item.rec.notes) {
          md.push(`  - ${note}`);
        }
      }
      md.push("");
    }
  }

  // Auto-generated redirect alias templates (static paths only)
  md.push("## Redirect alias templates");
  md.push("");
  md.push(
    "These are copy/paste templates for static legacy paths. If you use route groups (e.g. app/(dashboard)/...), place the file under the correct group so the URL matches. For dynamic paths (/:id), generate manually.",
  );
  md.push("");

  type Alias = { from: string; to: string; filePath: string; code: string; reason: string; collision: AliasCollision };
  const aliasMap = new Map<string, Alias>();
  const addAlias = (alias: Alias) => {
    if (aliasMap.has(alias.from)) return;
    aliasMap.set(alias.from, alias);
  };

  for (const item of pairsWithRec.slice(0, 15)) {
    const bestTo = item.rec.suggestedTargets?.[0] ?? null;
    const bestFrom = !item.rec.referrerRouteExists ? (item.rec.suggestedReferrers?.[0] ?? null) : null;

    // Target (404 route) redirect alias
    if (bestTo && isSafeForRedirectAliasTemplate(item.pair.notFoundRoute) && (item.rec.kind === "add_redirect_alias" || item.pair.estimated >= 20)) {
      addAlias({
        from: item.pair.notFoundRoute,
        to: bestTo,
        filePath: appPageFilePathForRoute(item.pair.notFoundRoute),
        code: redirectAliasTemplate(bestTo),
        reason: item.rec.kind === "add_redirect_alias" ? "recommended" : "high_volume",
        collision: collisionStatusForAlias(item.pair.notFoundRoute),
      });
    }

    // Referrer (legacy entry) redirect alias
    if (bestFrom && isSafeForRedirectAliasTemplate(item.pair.referrerPath)) {
      addAlias({
        from: item.pair.referrerPath,
        to: bestFrom,
        filePath: appPageFilePathForRoute(item.pair.referrerPath),
        code: redirectAliasTemplate(bestFrom),
        reason: "legacy_referrer",
        collision: collisionStatusForAlias(item.pair.referrerPath),
      });
    }
  }

  const aliasList = Array.from(aliasMap.values());
  if (aliasList.length === 0) {
    md.push("No safe static redirect alias templates could be generated for the selected top pairs.");
    md.push("(If your 404s contain dynamic segments like :id, create redirect templates manually.)");
  } else {
    for (const a of aliasList) {
      md.push(`### ${a.from} → ${a.to}`);
      md.push(`- File: \`${a.filePath}\``);
      md.push(`- Reason: ${a.reason}`);
      md.push(`- Status: ${collisionLabel(a.collision)} (${a.collision.status})`);
      md.push(`- Detail: ${a.collision.detail}`);

      if (a.collision.matchedPatterns && a.collision.matchedPatterns.length > 0) {
        md.push(`- Matching route patterns (top ${a.collision.matchedPatterns.length}):`);
        for (const m of a.collision.matchedPatterns) {
          md.push(`  - \`${m.patternPath}\` (e.g. \`${m.fileHint}\`)`);
        }
      }

      if (a.collision.status === "conflict") {
        md.push("- Action: **이 경로에 redirect alias 파일을 추가하지 마세요.** 이미 동일한 정적 라우트가 존재합니다. 404가 나는 원인(notFound/auth/파라미터)을 먼저 조사하세요.");
        md.push("");
        continue;
      }

      if (a.collision.status === "warn") {
        md.push("- Action: 이 경로는 동적 라우트에 의해 처리될 수 있습니다. 정적 redirect alias를 추가하면 해당 경로를 덮어쓰게 되니, 정말 레거시 호환이 필요한 경로인지 확인 후 적용하세요.");
      }

      md.push("```tsx");
      md.push(a.code);
      md.push("```");
      md.push("");
    }
  }
  md.push("");

  md.push("## Quick grep commands");
  md.push("");
  md.push(mdCodeBlock("Find where the broken target routes are referenced", [
    ...uniqueTargets.map((route) => `git grep -n "${route}" app components lib`),
  ]));
  md.push("");
  md.push(mdCodeBlock("Find the referrer pages", [
    ...uniqueReferrers.map((path) => `git grep -n "${path}" app components lib`),
  ]));
  md.push("");
  md.push(mdCodeBlock("Run regression checks", [
    "npm run check:page-links",
    "SMOKE_MODE=auth node ./scripts/smoke-test.js",
  ]));
  md.push("");

  md.push("## Fix checklist");
  md.push("");
  md.push("1. Pick the #1 pair and confirm the intended URL.");
  md.push("2. Locate the source link (Link href / router.push / redirect) using the grep commands above.");
  md.push("3. Fix by one of: (a) change link to a real route, (b) create missing page.tsx, (c) add redirect alias for legacy URL.");
  md.push("4. Prefer using routes builder (lib/standards/routes.ts) instead of hardcoded strings.");
  md.push("5. Re-run checks, deploy, then verify that the pair drops in /dashboard/ops/not-found.");
  md.push("");

  return md.join("\n");
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
  const limit = parseIntParam(url.searchParams.get("limit"), 1000, 50, 2000);
  const topPairs = parseIntParam(url.searchParams.get("pairs"), 10, 1, 50);

  const internalHosts = Array.from(
    new Set([...hostAliases(CANONICAL_HOST), ...hostAliases(SHORT_HOST)].filter(Boolean)),
  );

  const summary = await getNotFoundBrokenLinkSummary({
    sinceHours: hours,
    limit,
    internalHosts,
  });

  const bundle = toMarkdownBundle({
    hours,
    internalHosts,
    topPairs: summary.pairs.slice(0, topPairs),
    sampledTotal: summary.sampledTotal,
    estimatedTotal: summary.estimatedTotal,
    routeStatsByPath: summary.routeStatsByPath,
  });

  if (format === "json") {
    return jsonOkWithRequestId({ summary, bundle }, requestId, init);
  }

  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);
  headers.set("content-type", "text/markdown; charset=utf-8");
  headers.set("content-disposition", "attachment; filename=\"ops-not-found-broken-links-bundle.md\"");

  return new Response(bundle, { status: 200, headers });
}
