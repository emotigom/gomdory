import "server-only";

export type AdminEmailStatus = "sent" | "skipped" | "failed";

type SendAdminEmailInput = {
  subject: string;
  lines: string[];
  requestId?: string;
  timeoutMs?: number;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TO_EMAIL = "captsk@naver.com";

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

async function sendAdminEmail({ subject, lines, requestId, timeoutMs = 2500 }: SendAdminEmailInput): Promise<AdminEmailStatus> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("BILLING_NOTIFY_FROM_EMAIL");
  const to = env("BILLING_NOTIFY_TO_EMAIL") || DEFAULT_TO_EMAIL;

  if (!apiKey || !from) {
    console.warn("[billing] admin inquiry email skipped: missing config", { requestId, hasApiKey: Boolean(apiKey), hasFrom: Boolean(from) });
    return "skipped";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: lines.join("\n"),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[billing] admin inquiry email failed", { requestId, status: response.status });
      return "failed";
    }

    return "sent";
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.warn("[billing] admin inquiry email failed", { requestId, reason: aborted ? "timeout" : "fetch_error" });
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

type UpgradeAdminInput = {
  requestId: string;
  inquiryId: string;
  intent: "org" | "demo";
  userId: string;
  orgName: string;
  contactEmail: string;
  seats: number | null;
  role: string;
  inquiryType: string;
  timeline: string;
  usageScale: string;
  sanitizedMessage: string;
  host: string | null;
};

export function sendBillingUpgradeRequestAdminEmail(input: UpgradeAdminInput) {
  return sendAdminEmail({
    requestId: input.requestId,
    subject: `[Gomdory] 새 Pro/업그레이드 문의 - ${input.intent}`,
    lines: [
      "새 업그레이드 문의가 접수되었습니다.",
      "",
      `request_id: ${input.inquiryId}`,
      `ops.requestId: ${input.requestId}`,
      `intent: ${input.intent}`,
      `user.id: ${input.userId}`,
      `orgName: ${input.orgName}`,
      `contactEmail: ${input.contactEmail}`,
      `seats: ${input.seats ?? ""}`,
      `role: ${input.role}`,
      `inquiryType: ${input.inquiryType}`,
      `timeline: ${input.timeline}`,
      `usageScale: ${input.usageScale}`,
      `sanitizedMessage: ${input.sanitizedMessage}`,
      `host: ${input.host ?? ""}`,
      `created_context: billing_upgrade_request`,
    ],
  });
}

type InstitutionAdminInput = {
  requestId: string;
  inquiryId: string;
  requesterUserId: string;
  requesterEmail: string;
  orgName: string;
  contactName: string;
  contactEmailSanitized: string | null;
  term: "1m" | "1y";
  seats: number;
  plan: string;
  role: string;
  inquiryType: string;
  timeline: string;
  messageSanitized: string;
};

export function sendInstitutionRequestAdminEmail(input: InstitutionAdminInput) {
  return sendAdminEmail({
    requestId: input.requestId,
    subject: `[Gomdory] 새 기관 문의 - ${input.orgName}`,
    lines: [
      "새 기관 문의가 접수되었습니다.",
      "",
      `institution_request_id: ${input.inquiryId}`,
      `ops.requestId: ${input.requestId}`,
      `requester_user.id: ${input.requesterUserId}`,
      `requester_email: ${input.requesterEmail}`,
      `orgName: ${input.orgName}`,
      `contactName: ${input.contactName}`,
      `contactEmailSanitized: ${input.contactEmailSanitized ?? ""}`,
      `term: ${input.term}`,
      `seats: ${input.seats}`,
      `plan: ${input.plan}`,
      `role: ${input.role}`,
      `inquiryType: ${input.inquiryType}`,
      `timeline: ${input.timeline}`,
      `messageSanitized: ${input.messageSanitized}`,
    ],
  });
}
