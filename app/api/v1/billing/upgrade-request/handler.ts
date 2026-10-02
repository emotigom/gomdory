import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { sendBillingUpgradeRequestAdminEmail, type AdminEmailStatus } from "@/lib/billing/adminInquiryEmail.server";
import { type WithOpsContext } from "@/lib/ops/withOps";
import { maskPii } from "@/lib/safety/piiMask";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { sanitizeText } from "@/lib/safety/sanitizeText";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type UpgradeRequestBody = {
  orgName?: string;
  contactEmail?: string;
  seats?: number | null;
  message?: string;
  intent?: "org" | "demo";
  role?: "teacher" | "team_lead" | "school_admin" | "other";
  inquiryType?: "pilot" | "purchase" | "general";
  timeline?: "asap" | "this_month" | "next_quarter" | "exploring";
  usageScale?: "solo" | "small_team" | "department" | "school";
};

type UpgradeRequestDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  checkRateLimitFn?: typeof checkRateLimit;
  sendBillingUpgradeRequestAdminEmailFn?: typeof sendBillingUpgradeRequestAdminEmail;
};

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function sanitizeMessage(raw: string) {
  const sanitized = sanitizeText(raw ?? "", {
    maxLength: 800,
    maxLines: 8,
    maxRepeat: 3,
    maxConsecutiveNewlines: 2,
  }).text;
  const masked = maskPii(sanitized, { allowUrlDomains: [] });
  return masked.text;
}

export async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext, deps?: UpgradeRequestDeps) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  const createAdmin = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const rateLimiter = deps?.checkRateLimitFn ?? checkRateLimit;
  const sendAdminEmail = deps?.sendBillingUpgradeRequestAdminEmailFn ?? sendBillingUpgradeRequestAdminEmail;

  try {
    const { user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as UpgradeRequestBody;
    const orgName = (body.orgName ?? "").trim();
    const contactEmail = (body.contactEmail ?? "").trim();
    const seats = typeof body.seats === "number" && Number.isFinite(body.seats) ? Math.max(1, Math.floor(body.seats)) : null;
    const message = typeof body.message === "string" ? body.message : "";
    const intent = body.intent === "demo" ? "demo" : "org";
    const role = body.role === "team_lead" || body.role === "school_admin" || body.role === "other" ? body.role : "teacher";
    const inquiryType = body.inquiryType === "pilot" || body.inquiryType === "purchase" ? body.inquiryType : "general";
    const timeline =
      body.timeline === "asap" || body.timeline === "this_month" || body.timeline === "next_quarter" ? body.timeline : "exploring";
    const usageScale =
      body.usageScale === "small_team" || body.usageScale === "department" || body.usageScale === "school" ? body.usageScale : "solo";

    const normalizedOrgName = orgName || "개인 교사";
    if (!contactEmail || !isValidEmail(contactEmail)) {
      return jsonError("contact_email_invalid", "연락 가능한 이메일을 입력해주세요.", 400, { requestId: ops.requestId });
    }

    const admin = createAdmin();
    const rateResult = await rateLimiter(admin as never, {
      key: `upgrade:${user.id}`,
      windowSeconds: 60 * 60,
      limit: 3,
    });
    if (!rateResult.ok) {
      return jsonError("rate_limited", "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.", 429, {
        retryAfterSeconds: rateResult.retryAfterSeconds,
        requestId: ops.requestId,
      });
    }

    const sanitizedMessage = sanitizeMessage(message);
    const host = request.headers.get("host");

    const { data, error } = await admin
      .from("upgrade_requests")
      .insert({
        user_id: user.id,
        org_name: normalizedOrgName,
        contact_email: contactEmail,
        seats,
        message: sanitizedMessage,
        status: "new",
        meta: { host, requestId: ops.requestId, intent, role, inquiryType, timeline, usageScale },
      })
      .select("request_id")
      .single();

    if (error || !data) {
      return jsonError("upgrade_request_failed", "요청을 저장하지 못했습니다.", 502, { requestId: ops.requestId });
    }

    let emailNotification: AdminEmailStatus = "failed";
    try {
      emailNotification = await sendAdminEmail({
        requestId: ops.requestId,
        inquiryId: data.request_id,
        intent,
        userId: user.id,
        orgName: normalizedOrgName,
        contactEmail,
        seats,
        role,
        inquiryType,
        timeline,
        usageScale,
        sanitizedMessage,
        host,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      console.warn("[billing] upgrade request admin email threw", { requestId: ops.requestId, reason });
    }

    return jsonOk({
      requestId: data.request_id,
      upgradeRequestId: data.request_id,
      meta: { requestId: ops.requestId, emailNotification },
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    if (unauthorized) {
      return jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId: ops.requestId });
    }
    console.error("[billing] upgrade request failed", error);
    return jsonError("upgrade_request_failed", "요청을 저장하지 못했습니다.", 500, { requestId: ops.requestId });
  }
}
