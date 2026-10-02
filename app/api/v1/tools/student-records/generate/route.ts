import { type NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { generateStudentRecordBatch } from "@/lib/student-records/generationService";
import { getStudentRecordsProviderConfig, getStudentRecordsProviderConfigInvalidDiagnostic } from "@/lib/student-records/providerConfig";
import { createStudentRecordsProvider } from "@/lib/student-records/providerFactory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { createInvalidRequestDiagnostic } from "@/lib/student-records/invalidRequestDiagnostic";
import { type StudentRecordsInvalidRequestReason } from "@/lib/student-records/requestContract";
import { parseStudentRecordsGenerateRequest } from "@/lib/student-records/parseGenerateRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { headers: { "Cache-Control": "no-store" } };

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host.toLowerCase() === new URL(request.url).host.toLowerCase(); } catch { return false; }
}
function logInvalidRequest(requestId: string, validationStage: "parse" | "validate", safeReason: StudentRecordsInvalidRequestReason, bodyByteLength: number, rowCount?: number) {
  console.warn(JSON.stringify(createInvalidRequestDiagnostic(requestId, validationStage, safeReason, bodyByteLength, rowCount)));
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  if (!sameOrigin(request)) return jsonErrorWithRequestId("FORBIDDEN", "same_origin_required", requestId, 403, undefined, noStore);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonErrorWithRequestId("UNSUPPORTED_MEDIA_TYPE", "application_json_required", requestId, 415, undefined, noStore);
  let identity: Awaited<ReturnType<typeof requireUserApi>>;
  try { identity = await requireUserApi(); } catch { return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, noStore); }
  const parsed = await parseStudentRecordsGenerateRequest(request);
  if (!parsed.ok) {
    if (parsed.status === 413) return jsonErrorWithRequestId("PAYLOAD_TOO_LARGE", "request_too_large", requestId, 413, undefined, noStore);
    logInvalidRequest(requestId, parsed.reason === "row-invalid" || parsed.reason === "duplicate-row-id" ? "validate" : "parse", parsed.reason ?? "malformed-json", parsed.bodyByteLength ?? 0, parsed.rowCount);
    return jsonErrorWithRequestId("INVALID_INPUT", "invalid_request", requestId, 400, undefined, noStore);
  }
  const payload = parsed.value;
  const config = getStudentRecordsProviderConfig();
  if (config.configurationError) console.warn(JSON.stringify(getStudentRecordsProviderConfigInvalidDiagnostic()));
  if (config.mode === "openai" && (!identity.user.id || !config.allowedUserIds.has(identity.user.id.toLowerCase()))) return jsonErrorWithRequestId("FORBIDDEN", "generation_not_permitted", requestId, 403, undefined, noStore);
  if (config.mode === "openai" && !config.configurationError) {
    try {
      const limited = await checkRateLimit(createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0], { key: `student-records:openai:${identity.user.id}`, windowSeconds: 60, limit: 50 });
      if (!limited.ok) return jsonErrorWithRequestId("PROVIDER_RATE_LIMITED", "rate_limited", requestId, 429, { retryAfterSeconds: limited.retryAfterSeconds }, noStore);
    } catch { return jsonErrorWithRequestId("PROVIDER_UNAVAILABLE", "generation_unavailable", requestId, 503, undefined, noStore); }
  }
  const response = await generateStudentRecordBatch(payload, requestId, createStudentRecordsProvider(config, identity.user.id));
  return jsonOkWithRequestId(response, requestId, noStore);
}
