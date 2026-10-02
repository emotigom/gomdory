import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { isOpsOwner } from "@/lib/auth/opsOwners";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { buildRootCauseHints } from "@/lib/ops/diag/rootCauseHints";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OpsEventRow = {
  ts: string;
  level: string | null;
  kind: string | null;
  route: string | null;
  request_id: string | null;
  status: number | null;
  meta: Record<string, unknown> | null;
};

type AuditEventRow = {
  created_at: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_user_id: string | null;
  actor_anon_id: string | null;
  request_id: string | null;
};

const REQUEST_ID_PATTERN = /^[a-z0-9-]{8,64}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MESSAGE_LIMIT = 300;
const USER_ID_PREFIX = 8;

const NOTES = {
  auditEventsMissing: "audit_events_missing",
};

type SupabaseError = {
  message: string;
  code?: string | null;
  hint?: string | null;
  details?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clampLimit = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(value!), 1), MAX_LIMIT);
};

const maskUserId = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= USER_ID_PREFIX) return trimmed;
  return trimmed.slice(0, USER_ID_PREFIX);
};

const safeString = (value: unknown) => (typeof value === "string" ? value : null);

const pickMetaValue = (meta: Record<string, unknown> | null, key: string) => {
  if (!meta) return null;
  const value = meta[key];
  return safeString(value);
};

const extractUserId = (meta: Record<string, unknown> | null) =>
  safeString(meta?.userId) ??
  safeString(meta?.user_id) ??
  safeString(meta?.actor_user_id) ??
  safeString(meta?.actorUserId);

const extractCode = (meta: Record<string, unknown> | null) =>
  safeString(meta?.code) ?? safeString(meta?.errorCode) ?? safeString(meta?.error_code);

const extractStage = (meta: Record<string, unknown> | null, fallback?: string | null) =>
  safeString(meta?.stage) ?? safeString(meta?.kind) ?? fallback ?? null;

const extractMessage = (meta: Record<string, unknown> | null) => {
  const raw = safeString(meta?.message) ?? safeString(meta?.msg);
  if (!raw) return null;
  return raw.slice(0, MESSAGE_LIMIT);
};

const readServiceRoleToken = (request: Request) => {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const header = request.headers.get("x-service-role-key") ?? request.headers.get("x-admin-key");
  return header?.trim() ?? null;
};

const hasServiceRoleAccess = (request: Request) => {
  const serviceRoleKey = readEnvString("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return false;
  const provided = readServiceRoleToken(request);
  if (!provided) return false;
  return provided === serviceRoleKey;
};

const logSupabaseError = (label: string, error: SupabaseError) => {
  console.warn(`[ops/diag] ${label}`, {
    code: error.code ?? null,
    message: error.message,
    hint: error.hint ?? null,
    details: error.details ?? null,
  });
};

const isMissingColumnError = (error: SupabaseError, column: string) =>
  error.message?.includes(column) && error.message?.includes("does not exist");

const isMissingTableError = (error: SupabaseError, table: string) =>
  error.message?.includes(table) && error.message?.includes("does not exist");

async function fetchOpsEvents(client: ReturnType<typeof createSupabaseAdminClient>, requestId: string, limit: number) {
  const buildQuery = () =>
    client
      .from("ops_events")
      .select("ts, level, kind, route, request_id, status, meta")
      .order("ts", { ascending: false })
      .limit(limit);

  let { data, error } = await buildQuery().or(`request_id.eq.${requestId},gom_request_id.eq.${requestId}`);
  if (error && isMissingColumnError(error, "gom_request_id")) {
    ({ data, error } = await buildQuery().eq("request_id", requestId));
  }

  return { data: (data ?? []) as OpsEventRow[], error };
}

async function fetchAuditEvents(
  client: ReturnType<typeof createSupabaseAdminClient>,
  requestId: string,
  limit: number,
) {
  const buildQuery = () =>
    client
      .from("audit_events")
      .select("created_at, action, target_type, target_id, actor_user_id, actor_anon_id, request_id")
      .order("created_at", { ascending: false })
      .limit(limit);

  let { data, error } = await buildQuery().or(`request_id.eq.${requestId},gom_request_id.eq.${requestId}`);
  if (error && isMissingColumnError(error, "gom_request_id")) {
    ({ data, error } = await buildQuery().eq("request_id", requestId));
  }

  return { data: (data ?? []) as AuditEventRow[], error };
}

const summarizeCounts = (items: Array<string | null | undefined>) => {
  const counts = new Map<string, number>();
  for (const value of items) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  const headers = new Headers({ "cache-control": "no-store" });

  const { requestId: rawRequestId } = await params;
  const normalizedRequestId = rawRequestId?.trim() ?? "";
  if (!REQUEST_ID_PATTERN.test(normalizedRequestId)) {
    return jsonErrorWithRequestId(
      "invalid_request_id",
      "invalid_request_id",
      requestId,
      400,
      undefined,
      { headers },
    );
  }

  let isAuthorized = hasServiceRoleAccess(request);
  if (!isAuthorized) {
    try {
      const { user } = await requireUserApi();
      const email = user.email ?? null;
      isAuthorized = isOpsOwner(email) || isOpsAdmin(email);
      if (!isAuthorized) {
        return jsonErrorWithRequestId("forbidden", "forbidden", requestId, 403, undefined, { headers });
      }
    } catch {
      return jsonErrorWithRequestId("unauthorized", "unauthorized", requestId, 401, undefined, { headers });
    }
  }

  const url = new URL(request.url);
  const limit = clampLimit(Number.parseInt(url.searchParams.get("limit") ?? "", 10));

  let client: ReturnType<typeof createSupabaseAdminClient>;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase client unavailable";
    console.error("[ops/diag] admin client error", { message });
    return jsonErrorWithRequestId("internal_error", "internal_error", requestId, 500, undefined, { headers });
  }

  const notes: string[] = [];

  const { data: opsRows, error: opsError } = await fetchOpsEvents(client, normalizedRequestId, limit);
  if (opsError) {
    logSupabaseError("ops_events_failed", opsError);
    return jsonErrorWithRequestId("ops_events_failed", "ops_events_failed", requestId, 500, undefined, { headers });
  }

  let auditRows: AuditEventRow[] = [];
  const { data: auditData, error: auditError } = await fetchAuditEvents(
    client,
    normalizedRequestId,
    limit,
  );
  if (auditError) {
    if (isMissingTableError(auditError, "audit_events")) {
      notes.push(NOTES.auditEventsMissing);
      auditRows = [];
    } else {
      logSupabaseError("audit_events_failed", auditError);
      return jsonErrorWithRequestId(
        "audit_events_failed",
        "audit_events_failed",
        requestId,
        500,
        undefined,
        { headers },
      );
    }
  } else {
    auditRows = auditData ?? [];
  }

  const opsEvents = opsRows.map((row) => {
    const meta = isRecord(row.meta) ? row.meta : null;
    const stage = extractStage(meta, row.kind);
    const code = extractCode(meta);
    const path = pickMetaValue(meta, "path") ?? row.route ?? null;
    const method = pickMetaValue(meta, "method");
    const message = extractMessage(meta);
    const userIdMasked = maskUserId(extractUserId(meta));

    return {
      createdAt: row.ts,
      stage,
      level: row.level,
      code,
      message,
      path,
      method,
      status: row.status,
      userIdMasked,
    };
  });

  const auditEvents = auditRows.map((row) => ({
    createdAt: row.created_at,
    action: row.action,
    entity: row.target_type,
    entityId: row.target_id,
    userIdMasked: maskUserId(row.actor_user_id ?? row.actor_anon_id),
  }));

  const timestamps = [
    ...opsEvents.map((event) => event.createdAt),
    ...auditEvents.map((event) => event.createdAt),
  ].filter(Boolean);

  let firstSeenAt: string | null = null;
  let lastSeenAt: string | null = null;
  for (const ts of timestamps) {
    if (!ts) continue;
    if (!firstSeenAt || ts < firstSeenAt) firstSeenAt = ts;
    if (!lastSeenAt || ts > lastSeenAt) lastSeenAt = ts;
  }

  const topStages = summarizeCounts(opsEvents.map((event) => event.stage)).map((entry) => ({
    stage: entry.key,
    count: entry.count,
  }));
  const topCodes = summarizeCounts(opsEvents.map((event) => event.code)).map((entry) => ({
    code: entry.key,
    count: entry.count,
  }));
  const rootCauseHints = buildRootCauseHints({
    opsEvents,
    summary: {
      topStages,
      topCodes,
    },
  });

  const data = {
    requestId: normalizedRequestId,
    counts: {
      opsEvents: opsEvents.length,
      auditEvents: auditEvents.length,
    },
    summary: {
      firstSeenAt,
      lastSeenAt,
      topStages,
      topCodes,
    },
    rootCauseHints,
    opsEvents,
    auditEvents,
    notes,
  };

  return jsonOkWithRequestId(data, requestId, { headers });
}
