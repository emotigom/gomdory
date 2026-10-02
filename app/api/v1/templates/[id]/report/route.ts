import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { safeStudentText } from "@/lib/safety/safeStudentText";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_THRESHOLD = 3;
const RATE_LIMIT_MINUTE_WINDOW = 60;
const RATE_LIMIT_MINUTE_COUNT = 5;
const MAX_NOTE_LENGTH = 400;

type TemplateReportDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  autoHideThreshold?: number;
  checkRateLimitFn?: typeof checkRateLimit;
};

const ALLOWED_REASONS = new Set(["spam", "abuse", "privacy", "copyright", "other"]);

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function normalizeReason(input: unknown): string {
  if (typeof input !== "string") return "other";
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "pii") return "privacy";
  return ALLOWED_REASONS.has(trimmed) ? trimmed : "other";
}

function sanitizeNote(input: unknown): string {
  if (typeof input !== "string") return "";
  const safe = safeStudentText(input, { maxLength: MAX_NOTE_LENGTH });
  return safe.text ?? "";
}

function getReporterHash(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${agent}|${day}`).digest("hex");
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  requestContext: RequestContext,
  deps?: TemplateReportDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  const checkRateLimitFn = deps?.checkRateLimitFn ?? checkRateLimit;

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    user = null;
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return jsonError("invalid_template_id", "템플릿 ID 형식이 올바르지 않습니다.");
  }

  const body = (await request.json().catch(() => null)) as
    | { reason?: string | null; detail?: string | null; details?: string | null }
    | null;
  const reporterHash = getReporterHash(request);
  const rateKeyMinute = `report:${reporterHash}:minute`;
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const rateLimitDb = admin as unknown as Parameters<typeof checkRateLimit>[0];

  try {
    const minuteResult = await checkRateLimitFn(rateLimitDb, {
      key: rateKeyMinute,
      windowSeconds: RATE_LIMIT_MINUTE_WINDOW,
      limit: RATE_LIMIT_MINUTE_COUNT,
    });
    if (!minuteResult.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "rate_limited", message: "잠시 후 다시 시도해주세요." }, requestId: requestContext.requestId },
        { status: 429, headers: { "Retry-After": `${minuteResult.retryAfterSeconds}` } },
      );
    }
  } catch (error) {
    console.warn("report rate limit failed", error);
  }

  const { data: template, error: templateError } = await admin
    .from("templates")
    .select("template_id, owner_user_id, visibility, moderation, stats, status, report_count")
    .eq("template_id", id)
    .maybeSingle();

  if (templateError) {
    return jsonError("template_lookup_failed", templateError.message, 502);
  }

  if (!template) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  const autoHidden = Boolean((template.moderation as Record<string, unknown> | null | undefined)?.autoHidden);
  if (autoHidden && template.owner_user_id !== user?.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if ((template.status ?? "active") !== "active" && template.owner_user_id !== user?.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if (template.visibility === "hidden" && template.owner_user_id !== user?.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if (template.visibility !== "public" && template.visibility !== "unlisted" && template.owner_user_id !== user?.id) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  const reason = normalizeReason(body?.reason);
  const note = sanitizeNote(body?.details ?? body?.detail);

  const insertPayload = {
    template_id: id,
    reporter_user_id: user?.id ?? null,
    reporter_anon_id: user?.id ? null : reporterHash,
    reporter_hash: reporterHash,
    reason,
    note,
    request_id: request.headers.get("x-request-id"),
    host: request.headers.get("host"),
  };

  const insertResult = await admin.from("template_reports").insert(insertPayload).select("report_id").single();
  if (insertResult.error && insertResult.error.code !== "23505") {
    return jsonError("template_report_failed", insertResult.error.message, 502);
  }

  const { count: reportCount, error: countError } = await admin
    .from("template_reports")
    .select("report_id", { head: true, count: "exact" })
    .eq("template_id", id);

  if (countError) {
    return jsonError("template_report_failed", countError.message, 502);
  }

  const threshold =
    deps?.autoHideThreshold ??
    (Number(readEnvString("TEMPLATE_AUTOHIDE_THRESHOLD") ?? "") || DEFAULT_THRESHOLD);

  const shouldHide = (reportCount ?? 0) >= threshold;
  const nextStats = {
    ...(template.stats as Record<string, unknown> | null | undefined),
    reports: reportCount ?? 0,
  };
  const nextModeration = {
    ...(template.moderation as Record<string, unknown> | null | undefined),
    reportCount: reportCount ?? 0,
    lastReason: reason,
    autoHidden: shouldHide,
  };

  await admin
    .from("templates")
    .update({
      status: shouldHide ? "hidden" : template.status ?? "active",
      stats: nextStats,
      moderation: nextModeration,
      report_count: reportCount ?? 0,
      last_reported_at: new Date().toISOString(),
    })
    .eq("template_id", id);

  return NextResponse.json({
    ok: true,
    hidden: shouldHide,
    status: shouldHide ? "hidden" : "active",
    reportCount: reportCount ?? 0,
  });
}

export const POST = withRequestContext(handlePost);
