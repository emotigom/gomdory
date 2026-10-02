export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { listBoardsForUser } from "@/lib/data/boards.server";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { logWithContext } from "@/lib/ops/logWithContext";
import { normalizeChatOutcome } from "@/lib/ops/teacherTelemetry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SummaryRange = "24h" | "7d";

type ChatTotals = {
  chat: number;
  local: number;
  remote: number;
  coach: number;
  retry: number;
};

type AiStats = {
  remoteOk: number;
  remoteFail: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
};

type WebLLMStatusSummary = {
  blockedCount: number;
  degradedCount: number;
  lastStatus?: { status: string; code: string | null; at: string };
};

type ClassSummary = {
  shareCode: string;
  totals: ChatTotals;
  rates: { local: number; fallback: number; retry: number };
  ai: AiStats;
  webllm: WebLLMStatusSummary;
};

type SummaryPayload = {
  range: SummaryRange;
  classes: ClassSummary[];
};

type InternalSummary = {
  shareCode: string;
  totals: ChatTotals;
  ai: AiStats;
  webllm: WebLLMStatusSummary;
  aiLatencies: number[];
  lastStatusAt: number;
};

const RANGE_WINDOW_HOURS: Record<SummaryRange, number> = {
  "24h": 24,
  "7d": 24 * 7,
};

const CACHE_TTL_MS = 20_000;
const summaryCache = new Map<string, { expiresAt: number; payload: SummaryPayload }>();

const BLOCKED_WEBLLM_STATUSES = new Set([
  "DISABLED",
  "UNSUPPORTED",
  "ENV_MISSING",
  "MODEL_ID_UNKNOWN",
  "ASSET_UNREACHABLE",
  "CORS_BLOCKED",
  "ERROR",
]);

const parseRange = (value?: string | null): SummaryRange => (value === "7d" ? "7d" : "24h");

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
  return Math.round(sorted[index]);
};

const buildEmptySummary = (shareCode: string): InternalSummary => ({
  shareCode,
  totals: {
    chat: 0,
    local: 0,
    remote: 0,
    coach: 0,
    retry: 0,
  },
  ai: {
    remoteOk: 0,
    remoteFail: 0,
  },
  webllm: {
    blockedCount: 0,
    degradedCount: 0,
    lastStatus: undefined,
  },
  aiLatencies: [],
  lastStatusAt: 0,
});

async function handleGet(request: NextRequest, _context: unknown, requestContext: RequestContext) {
  const searchParams = request.nextUrl.searchParams;
  const range = parseRange(searchParams.get("range"));
  const shareCodeParam = searchParams.get("shareCode")?.trim() || null;
  const headers = new Headers({ "cache-control": "no-store" });

  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("unauthorized", "Unauthorized", requestContext.requestId, 401, undefined, {
      headers,
    });
  }

  const supabase = createSupabaseServerClient();
  const boards = await listBoardsForUser({
    supabase,
    userId,
    includeHeroFileId: false,
  });
  const shareCodes = Array.from(
    new Set(
      boards
        .filter((board) => board.share_enabled && board.share_code)
        .map((board) => board.share_code)
        .filter((code): code is string => Boolean(code)),
    ),
  );

  if (shareCodeParam && !shareCodes.includes(shareCodeParam)) {
    return jsonErrorWithRequestId("forbidden", "Not allowed", requestContext.requestId, 403, undefined, {
      headers,
    });
  }

  const selectedShareCodes = shareCodeParam ? [shareCodeParam] : shareCodes;
  if (selectedShareCodes.length === 0) {
    return jsonOkWithRequestId({ range, classes: [] }, requestContext.requestId, { headers });
  }

  const cacheKey = `${userId}:${range}:${shareCodeParam ?? "all"}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonOkWithRequestId(cached.payload, requestContext.requestId, { headers });
  }

  logWithContext({
    level: "info",
    stage: "teacherAiTelemetrySummary",
    requestId: requestContext.requestId,
    route: "api/v1/teacher/ai-telemetry/summary",
    meta: {
      range,
      shareCode: shareCodeParam ?? undefined,
      classes: selectedShareCodes.length,
    },
  });

  const admin = createSupabaseAdminClient();
  const sinceIso = new Date(Date.now() - RANGE_WINDOW_HOURS[range] * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("ops_events")
    .select("id, ts, meta")
    .eq("kind", "edu_project_report")
    .gte("ts", sinceIso)
    .in("meta->>shareCode", selectedShareCodes)
    .order("ts", { ascending: false })
    .limit(20_000);

  if (error) {
    return jsonErrorWithRequestId(
      "opsEventsFailed",
      "Unable to fetch ops events",
      requestContext.requestId,
      500,
      undefined,
      { headers },
    );
  }

  const summaries = new Map<string, InternalSummary>();
  selectedShareCodes.forEach((shareCode) => summaries.set(shareCode, buildEmptySummary(shareCode)));

  (data ?? []).forEach((row) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const shareCode = toStringValue(meta.shareCode);
    if (!shareCode) return;
    const summary = summaries.get(shareCode);
    if (!summary) return;

    const eventType = toStringValue(meta.type);
    if (!eventType) return;

    if (eventType === "EDU_CHAT_SLA") {
      const outcome = normalizeChatOutcome(meta.outcome);
      if (!outcome) return;
      summary.totals.chat += 1;
      if (outcome === "local") summary.totals.local += 1;
      if (outcome === "remote") summary.totals.remote += 1;
      if (outcome === "coach") summary.totals.coach += 1;
      if (outcome === "retryShown") summary.totals.retry += 1;
      return;
    }

    if (eventType === "EDU_AI_FALLBACK") {
      const ok = typeof meta.ok === "boolean" ? meta.ok : null;
      const latencyMs = toNumber(meta.latencyMs);
      if (ok === true) summary.ai.remoteOk += 1;
      if (ok === false) summary.ai.remoteFail += 1;
      if (latencyMs != null) {
        summary.aiLatencies.push(latencyMs);
      }
      return;
    }

    if (eventType === "EDU_WEBLLM_STATUS") {
      const status = toStringValue(meta.status);
      if (!status) return;
      if (status === "DEGRADED") {
        summary.webllm.degradedCount += 1;
      }
      if (BLOCKED_WEBLLM_STATUSES.has(status)) {
        summary.webllm.blockedCount += 1;
      }
      const ts = typeof row.ts === "string" ? Date.parse(row.ts) : Date.now();
      if (ts >= summary.lastStatusAt) {
        summary.lastStatusAt = ts;
        summary.webllm.lastStatus = {
          status,
          code: toStringValue(meta.code),
          at: typeof row.ts === "string" ? row.ts : new Date(ts).toISOString(),
        };
      }
    }
  });

  const classes = Array.from(summaries.values()).map((entry) => {
    const total = entry.totals.chat;
    const localRate = total ? entry.totals.local / total : 0;
    const fallbackRate = total ? (total - entry.totals.local) / total : 0;
    const retryRate = total ? entry.totals.retry / total : 0;
    const p50LatencyMs = percentile(entry.aiLatencies, 0.5);
    const p95LatencyMs = percentile(entry.aiLatencies, 0.95);
    const ai: AiStats = {
      remoteOk: entry.ai.remoteOk,
      remoteFail: entry.ai.remoteFail,
      ...(p50LatencyMs != null ? { p50LatencyMs } : {}),
      ...(p95LatencyMs != null ? { p95LatencyMs } : {}),
    };

    return {
      shareCode: entry.shareCode,
      totals: entry.totals,
      rates: { local: localRate, fallback: fallbackRate, retry: retryRate },
      ai,
      webllm: entry.webllm,
    };
  });

  const payload: SummaryPayload = { range, classes };
  summaryCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });

  return jsonOkWithRequestId(payload, requestContext.requestId, { headers });
}

export const GET = withRequestContext(handleGet);
