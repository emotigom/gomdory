import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COOKIE_NAME = ["edu", "anon", "id"].join("_");
const REPORTER_ANON_ID_KEY = ["reporter", "anon", "id"].join("_");
const REPORTER_NAME_KEY = ["reporter", "name"].join("_");

type ReportBody = {
  slug?: string;
  reason?: string;
  note?: string | null;
};

type EduReportInsertPayload = Database["public"]["Tables"]["edu_reports"]["Insert"];

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as ReportBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const slug = payload.slug?.trim().toLowerCase() ?? "";
  const reason = payload.reason?.trim() ?? "";
  const note = payload.note?.trim() ?? "";

  if (!slug || !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!reason) {
    return jsonErrorWithRequestId(
      "INVALID_REASON",
      "reason is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const anonId = request.cookies.get(COOKIE_NAME)?.value?.trim() ?? "";
  const subject = await getRateLimitSubject(request, anonId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:report:${slug}:${subject}`,
        windowSeconds: 60,
        limit: 10,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "eduProjectReport",
        requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          stage: "edu_project_report",
          action: "rateLimited",
          slug,
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("edu_projects")
    .select("board_id")
    .eq("slug", slug)
    .maybeSingle();

  if (projectError) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "eduProjectReport",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_report",
          action: "projectLookupFailed",
          slug,
          message: projectError.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId(
      "PROJECT_LOOKUP_FAILED",
      projectError.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!project) {
    return jsonErrorWithRequestId("PROJECT_NOT_FOUND", "project not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const reportInsert: EduReportInsertPayload = {
    slug,
    ["board_id"]: project.board_id,
    [REPORTER_ANON_ID_KEY]: anonId || null,
    [REPORTER_NAME_KEY]: null,
    reason,
    note: note || null,
  };
  const { error } = await supabase.from("edu_reports").insert(reportInsert);

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "eduProjectReport",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_report",
          action: "insertFailed",
          slug,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId("REPORT_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  void recordOpsEvent(
    toSnakeKeys({
      level: "info",
      kind: "eduProjectReport",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_project_report",
        action: "reported",
        slug,
        boardId: project.board_id,
        hasNote: Boolean(note),
        result: "ok",
      },
    }) as Parameters<typeof recordOpsEvent>[0],
    { sampleRate: 1, hardLimitPerMinute: 120 },
  );

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
