export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

type PatchPayload = {
  summary?: string | null;
  teacherNotes?: string | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; sessionId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const validateEnv = deps?.validateSupabaseEnvFn ?? validateSupabaseEnv;

  const requestId = getOrCreateRequestId(request);
  const logRequest = (status: number, context?: Record<string, unknown>) => {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    console.log(
      JSON.stringify(
        {
          level,
          route: request.nextUrl.pathname,
          method: request.method,
          status,
          requestId,
          ...(context ?? {}),
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  };

  const envValidation = validateEnv();

  if (!envValidation.ok) {
    const response = jsonErrorWithRequestId(
      "supabase_env_missing",
      "리포트를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      requestId,
      500,
      { hint: "supabase_env_missing" },
    );
    logRequest(response.status, { code: "supabase_env_missing", hint: "supabase_env_missing" });
    return response;
  }

  let userId: string;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    const response = jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401, {
      hint: "supabase_auth_failed",
    });
    logRequest(response.status, { code: "unauthorized", hint: "supabase_auth_failed" });
    return response;
  }

  const { classId, sessionId } = await params;
  if (!classId || !sessionId) {
    const response = jsonErrorWithRequestId("invalid_request", "회차 정보를 확인하지 못했습니다.", requestId, 400, {
      hint: "invalid_request",
    });
    logRequest(response.status, { code: "invalid_request", hint: "invalid_request" });
    return response;
  }

  let payload: PatchPayload | null = null;
  try {
    payload = (await request.json()) as PatchPayload;
  } catch {
    payload = null;
  }

  const summary = normalizeText(payload?.summary);
  const teacherNotes = normalizeText(payload?.teacherNotes);

  const updates: Record<string, unknown> = {
    summary,
    teacher_notes: teacherNotes,
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("class_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("class_id", classId)
      .eq("created_by", userId)
      .select("summary, teacher_notes, updated_at")
      .single();

    if (error || !data) {
      const message = error?.message ?? "리포트를 저장하지 못했습니다.";
      const response = jsonErrorWithRequestId("session_report_update_failed", message, requestId, 500, {
        hint: "update_failed",
      });
      logRequest(response.status, { code: "session_report_update_failed", hint: "update_failed" });
      return response;
    }

    const response = jsonOkWithRequestId(
      {
        summary: data.summary ?? null,
        teacherNotes: data.teacher_notes ?? null,
        updatedAt: data.updated_at ?? null,
      },
      requestId,
    );
    logRequest(response.status, { code: "session_report_updated" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "리포트를 저장하지 못했습니다.";
    const response = jsonErrorWithRequestId("session_report_update_failed", message, requestId, 500, {
      hint: "update_failed",
    });
    logRequest(response.status, { code: "session_report_update_failed", hint: "update_failed" });
    return response;
  }
}
