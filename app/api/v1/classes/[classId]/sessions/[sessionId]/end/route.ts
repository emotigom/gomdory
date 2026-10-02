export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { endClassSession } from "@/lib/data/classArchive.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  endClassSessionFn?: typeof endClassSession;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; sessionId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const endSession = deps?.endClassSessionFn ?? endClassSession;
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
      "수업을 종료할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      requestId,
      500,
      { hint: "supabase_env_missing" },
    );
    logRequest(response.status, { code: "supabase_env_missing", hint: "supabase_env_missing" });
    return response;
  }

  try {
    await ensureUser();
  } catch {
    const response = jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401, {
      hint: "supabase_auth_failed",
    });
    logRequest(response.status, { code: "unauthorized", hint: "supabase_auth_failed" });
    return response;
  }

  const { classId, sessionId } = await params;
  if (!classId || !UUID_REGEX.test(sessionId)) {
    const response = jsonErrorWithRequestId("invalid_session", "세션을 확인하지 못했습니다.", requestId, 400, {
      hint: "invalid_session",
    });
    logRequest(response.status, { code: "invalid_session", hint: "invalid_session" });
    return response;
  }

  try {
    const session = await endSession({ classId, sessionId });
    const response = jsonOkWithRequestId({ session }, requestId);
    logRequest(response.status, { code: "class_session_ended" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "수업을 종료하지 못했습니다.";
    const response = jsonErrorWithRequestId("class_session_end_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_session_end_failed", hint: "unexpected" });
    return response;
  }
}
