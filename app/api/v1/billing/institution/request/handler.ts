import { NextRequest } from "next/server";

import type { OperationalRouteContext } from "@/lib/api/server/operationalRoute";
import { jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { sendInstitutionRequestAdminEmail, type AdminEmailStatus } from "@/lib/billing/adminInquiryEmail.server";
import { logAudit } from "@/lib/data/audit";
import { apiErrorResponse } from "@/lib/http/apiError";
import { maskPII } from "@/lib/safety/piiMask";
import { safeStudentText } from "@/lib/safety/safeStudentText";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RequestPayload = {
  org_name?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  plan?: string;
  term?: "1m" | "1y";
  seats?: number;
  message?: string | null;
  meta?: Record<string, unknown>;
};

function sanitizeContactEmail(input: string | null | undefined) {
  const normalized = (input ?? "").trim();
  if (!normalized) return { text: null, hits: [] as string[] };
  const masked = maskPII(normalized);
  return { text: masked.text, hits: masked.hits };
}

export type InstitutionRequestDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  logAuditFn?: typeof logAudit;
  sendInstitutionRequestAdminEmailFn?: typeof sendInstitutionRequestAdminEmail;
};

export async function handlePost(request: NextRequest, _context: unknown, ops: OperationalRouteContext, deps?: InstitutionRequestDeps) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  const createServer = deps?.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const auditLog = deps?.logAuditFn ?? logAudit;
  const sendAdminEmail = deps?.sendInstitutionRequestAdminEmailFn ?? sendInstitutionRequestAdminEmail;

  const { user } = await requireUser();
  const supabase = createServer();
  const body = (await request.json().catch(() => ({}))) as RequestPayload;

  const orgName = (body.org_name ?? "").trim();
  if (!orgName) {
    return apiErrorResponse("invalid_org", "기관명을 입력해주세요.", 400, { requestId: ops.requestId });
  }

  const contactNameSafe = safeStudentText(body.contact_name ?? "", { maxLength: 120 });
  const contactName = contactNameSafe.text;
  const contactEmailSanitized = sanitizeContactEmail(body.contact_email ?? "");
  const messageSanitized = safeStudentText(body.message ?? "", { maxLength: 400 });
  const seats = Number.isFinite(body.seats) && (body.seats ?? 1) > 0 ? Math.max(1, Number(body.seats)) : 1;
  const term = body.term === "1m" || body.term === "1y" ? body.term : "1y";
  const plan = body.plan ?? "pro";
  const role =
    body.meta && typeof body.meta.role === "string" && ["teacher", "team_lead", "school_admin", "other"].includes(body.meta.role)
      ? body.meta.role
      : "school_admin";
  const inquiryType =
    body.meta && typeof body.meta.inquiryType === "string" && ["pilot", "purchase", "general"].includes(body.meta.inquiryType)
      ? body.meta.inquiryType
      : "general";
  const timeline =
    body.meta && typeof body.meta.timeline === "string" && ["asap", "this_month", "next_quarter", "exploring"].includes(body.meta.timeline)
      ? body.meta.timeline
      : "exploring";

  const { error, data } = await supabase
    .from("institution_requests")
    .insert({
      requester_user_id: user.id,
      requester_email: user.email ?? "",
      org_name: orgName,
      contact_name: contactName,
      contact_email: contactEmailSanitized.text,
      plan,
      term,
      seats,
      message: messageSanitized.text,
      meta: {
        ...((body.meta as Record<string, unknown> | undefined) ?? {}),
        role,
        inquiryType,
        timeline,
        contact_name_flags: contactNameSafe.flags,
        contact_email_hits: contactEmailSanitized.hits,
        message_flags: messageSanitized.flags,
        message_pii_hits: messageSanitized.piiHits,
      },
    })
    .select("id, status, created_at")
    .single();

  if (error || !data) {
    return apiErrorResponse("request_failed", "구매 요청을 저장하지 못했습니다.", 500, { requestId: ops.requestId });
  }

  void auditLog({
    action: "request_submitted",
    targetType: "institution_request",
    targetId: data.id,
    meta: {
      orgName,
      term,
      seats,
      role,
      inquiryType,
      timeline,
      requester: user.email,
    },
  });

  let emailNotification: AdminEmailStatus = "failed";
  try {
    emailNotification = await sendAdminEmail({
      requestId: ops.requestId,
      inquiryId: data.id,
      requesterUserId: user.id,
      requesterEmail: user.email ?? "",
      orgName,
      contactName: contactName ?? "",
      contactEmailSanitized: contactEmailSanitized.text,
      term,
      seats,
      plan,
      role,
      inquiryType,
      timeline,
      messageSanitized: messageSanitized.text ?? "",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.warn("[billing] institution request admin email threw", { requestId: ops.requestId, reason });
  }

  return jsonOk({
    id: data.id,
    status: data.status,
    createdAt: data.created_at,
    requestId: ops.requestId,
    meta: { emailNotification },
  });
}
