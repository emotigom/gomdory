export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { normalizeOpsBannerInput } from "@/lib/ops/banners";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 60;

async function requireOpsAdminEmail(): Promise<string | null> {
  try {
    const { user } = await requireUserApi();
    const userEmail = user.email ?? null;
    if (!userEmail || !isOpsAdmin(userEmail)) return null;
    return userEmail;
  } catch {
    return null;
  }
}

async function enforceOpsRateLimit(request: Request, requestId: string) {
  const subject = await getRateLimitSubject(request, null);
  const result = await checkRateLimit(createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0], {
    key: `ops:banners:${subject}`,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    limit: RATE_LIMIT_MAX,
  });
  if (result.ok) return null;
  return jsonErrorWithRequestId("RATE_LIMITED", "rate limited", requestId, 429, { hint: "ops banners" });
}

async function handleGet(request: Request, _context: unknown, ops: WithOpsContext) {
  const userEmail = await requireOpsAdminEmail();
  if (!userEmail) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const limited = await enforceOpsRateLimit(request, ops.requestId);
  if (limited) return limited;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ops_banners" as never)
    .select("message, href, label, level, enabled, starts_at, ends_at, updated_at" as never)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return jsonErrorWithRequestId("DB_FAILED", "failed to fetch banner", ops.requestId, 500);
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const rowStartsAt = row["starts_at"];
  const rowEndsAt = row["ends_at"];
  const rowUpdatedAt = row["updated_at"];
  const banner = normalizeOpsBannerInput({
    message: typeof row.message === "string" ? row.message : "",
    href: typeof row.href === "string" ? row.href : null,
    label: typeof row.label === "string" ? row.label : null,
    enabled: Boolean(row.enabled),
    level: typeof row.level === "string" ? row.level : null,
    startsAt: typeof rowStartsAt === "string" ? rowStartsAt : null,
    endsAt: typeof rowEndsAt === "string" ? rowEndsAt : null,
  });

  return jsonOkWithRequestId({ banner, updatedAt: typeof rowUpdatedAt === "string" ? rowUpdatedAt : null }, ops.requestId);
}

async function handlePut(request: Request, _context: unknown, ops: WithOpsContext) {
  const userEmail = await requireOpsAdminEmail();
  if (!userEmail) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const limited = await enforceOpsRateLimit(request, ops.requestId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid body", ops.requestId, 400, { hint: "json required" });
  }

  const banner = normalizeOpsBannerInput((body ?? {}) as Record<string, unknown>);
  if (banner.startsAt && banner.endsAt && banner.startsAt > banner.endsAt) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid banner window", ops.requestId, 400, { hint: "startsAt <= endsAt" });
  }
  const supabase = createSupabaseAdminClient();

  const insertPayload = toSnakeKeys({
    message: banner.message,
    href: banner.href,
    label: banner.label,
    enabled: banner.enabled,
    level: banner.level,
    startsAt: banner.startsAt,
    endsAt: banner.endsAt,
  });

  const { error } = await supabase.from("ops_banners" as never).insert(insertPayload as never);

  if (error) {
    return jsonErrorWithRequestId("DB_FAILED", "failed to save banner", ops.requestId, 500);
  }

  return jsonOkWithRequestId({ banner }, ops.requestId);
}

export const GET = withOps(handleGet, { log: true, errorCode: ErrorCodes.dbFailed });
export const PUT = withOps(handlePut, { log: true, errorCode: ErrorCodes.dbFailed });
