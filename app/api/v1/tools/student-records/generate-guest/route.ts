import { type NextRequest } from "next/server";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { generateStudentRecordBatch } from "@/lib/student-records/generationService";
import { STUDENT_RECORDS_GUEST_COOKIE, STUDENT_RECORDS_GUEST_MAX_STUDENTS, getStudentRecordsGuestConfig, hashGuestRateLimitSubject, verifyGuestCookieValue } from "@/lib/student-records/guestAccess";
import { createStudentRecordsGuestProvider } from "@/lib/student-records/guestProviderFactory";
import { parseStudentRecordsGenerateRequest } from "@/lib/student-records/parseGenerateRequest";
import { createInvalidRequestDiagnostic } from "@/lib/student-records/invalidRequestDiagnostic";
import { createQ2B9ELlmFixtureProvider, isQ2B9ELlmFixtureRequest } from "@/lib/q2/browser/llmIntegrationFixture";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { headers: { "Cache-Control": "no-store" } };
function sameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).host.toLowerCase() === new URL(request.url).host.toLowerCase(); } catch { return false; } }
function requestIp(request: NextRequest) { return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  if (!sameOrigin(request)) return jsonErrorWithRequestId("FORBIDDEN", "same_origin_required", requestId, 403, undefined, noStore);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonErrorWithRequestId("UNSUPPORTED_MEDIA_TYPE", "application_json_required", requestId, 415, undefined, noStore);
  const fixture = isQ2B9ELlmFixtureRequest(request);
  const config = getStudentRecordsGuestConfig();
  const verified = fixture || await verifyGuestCookieValue(request.cookies.get(STUDENT_RECORDS_GUEST_COOKIE)?.value, config);
  if (!verified) return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, noStore);
  const parsed = await parseStudentRecordsGenerateRequest(request);
  if (!parsed.ok) {
    if (parsed.status === 413) return jsonErrorWithRequestId("PAYLOAD_TOO_LARGE", "request_too_large", requestId, 413, undefined, noStore);
    console.warn(JSON.stringify(createInvalidRequestDiagnostic(requestId, parsed.reason === "row-invalid" || parsed.reason === "duplicate-row-id" ? "validate" : "parse", parsed.reason ?? "malformed-json", parsed.bodyByteLength ?? 0, parsed.rowCount)));
    return jsonErrorWithRequestId("INVALID_INPUT", "invalid_request", requestId, 400, undefined, noStore);
  }
  if (parsed.value.rows.length > STUDENT_RECORDS_GUEST_MAX_STUDENTS) return jsonErrorWithRequestId("INVALID_INPUT", "invalid_request", requestId, 400, undefined, noStore);
  const cookieSecret = config.cookieSecret;
  if (!fixture) {
    if (config.configurationError || !cookieSecret) return jsonErrorWithRequestId("PROVIDER_UNAVAILABLE", "generation_unavailable", requestId, 503, undefined, noStore);
    try {
      const visitorKey = await hashGuestRateLimitSubject(requestIp(request), cookieSecret);
      const db = createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0];
      const visitor = await checkRateLimit(db, { key: `student-records:guest:visitor:${visitorKey}`, windowSeconds: 600, limit: 50 });
      if (!visitor.ok) return jsonErrorWithRequestId("PROVIDER_RATE_LIMITED", "rate_limited", requestId, 429, { retryAfterSeconds: visitor.retryAfterSeconds }, noStore);
      const global = await checkRateLimit(db, { key: "student-records:guest:global", windowSeconds: 86_400, limit: 1_500 });
      if (!global.ok) return jsonErrorWithRequestId("PROVIDER_RATE_LIMITED", "rate_limited", requestId, 429, { retryAfterSeconds: global.retryAfterSeconds }, noStore);
    } catch { return jsonErrorWithRequestId("PROVIDER_UNAVAILABLE", "generation_unavailable", requestId, 503, undefined, noStore); }
  }
  const response = await generateStudentRecordBatch(parsed.value, requestId, fixture ? createQ2B9ELlmFixtureProvider() : createStudentRecordsGuestProvider(config, verified));
  return jsonOkWithRequestId(response, requestId, noStore);
}
