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
import { getNotFoundBrokenLinkSummary } from "@/lib/ops/notFoundBrokenLinks";

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

function csvEscape(value: string) {
  const v = value.replace(/\r?\n/g, " ");
  if (/[\",]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
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
  const format = url.searchParams.get("format") ?? "json";
  const hours = parseIntParam(url.searchParams.get("hours"), 24, 1, 24 * 14);
  const limit = parseIntParam(url.searchParams.get("limit"), 1000, 50, 2000);

  const internalHosts = Array.from(
    new Set([...hostAliases(CANONICAL_HOST), ...hostAliases(SHORT_HOST)].filter(Boolean)),
  );

  const summary = await getNotFoundBrokenLinkSummary({
    sinceHours: hours,
    limit,
    internalHosts,
  });

  if (format === "csv") {
    const headers = new Headers(init.headers);
    headers.set("x-request-id", requestId);
    headers.set("x-gom-request-id", requestId);
    headers.set("content-type", "text/csv; charset=utf-8");
    headers.set("content-disposition", "attachment; filename=\"ops-not-found-broken-links.csv\"");

    const lines = [
      ["referrerPath", "notFoundRoute", "sampled", "estimated", "lastSeenTs"].join(","),
      ...summary.pairs.map((row) =>
        [
          csvEscape(row.referrerPath),
          csvEscape(row.notFoundRoute),
          String(row.sampled),
          String(row.estimated),
          csvEscape(row.lastSeenTs),
        ].join(","),
      ),
    ];

    return new Response(lines.join("\n"), { status: 200, headers });
  }

  return jsonOkWithRequestId(
    {
      summary,
    },
    requestId,
    init,
  );
}
