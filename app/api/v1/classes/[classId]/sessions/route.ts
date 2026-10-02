export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { listClassSessions } from "@/lib/data/classArchive.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  listClassSessionsFn?: typeof listClassSessions;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const listSessions = deps?.listClassSessionsFn ?? listClassSessions;
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
      "회차 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  const { classId } = await params;
  if (!classId) {
    const response = jsonErrorWithRequestId("invalid_class", "클래스를 확인하지 못했습니다.", requestId, 400, {
      hint: "invalid_class",
    });
    logRequest(response.status, { code: "invalid_class", hint: "invalid_class" });
    return response;
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);
  const cursor = url.searchParams.get("cursor");
  const sectionIdParam = url.searchParams.get("sectionId");
  const sectionId = sectionIdParam && sectionIdParam !== "unassigned" ? sectionIdParam : null;

  try {
    const sessions = await listSessions({ classId, sectionId, limit, cursor });
    const nextCursor = sessions.length === limit ? sessions[sessions.length - 1]?.started_at ?? null : null;
    const response = jsonOkWithRequestId({ sessions, nextCursor }, requestId);
    logRequest(response.status, { code: "class_sessions_loaded" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "회차 목록을 불러오지 못했습니다.";
    const response = jsonErrorWithRequestId("class_sessions_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_sessions_failed", hint: "unexpected" });
    return response;
  }
}
