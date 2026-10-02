export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createClassSection, listClassSections } from "@/lib/data/classArchive.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  listClassSectionsFn?: typeof listClassSections;
  createClassSectionFn?: typeof createClassSection;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const listSections = deps?.listClassSectionsFn ?? listClassSections;
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
      "단원 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  try {
    const sections = await listSections(classId);
    const response = jsonOkWithRequestId({ sections }, requestId);
    logRequest(response.status, { code: "class_sections_loaded" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "단원 목록을 불러오지 못했습니다.";
    const response = jsonErrorWithRequestId("class_sections_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_sections_failed", hint: "unexpected" });
    return response;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const createSection = deps?.createClassSectionFn ?? createClassSection;
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
      "단원을 추가할 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  const body = (await request.json().catch(() => null)) as { title?: unknown; sortIndex?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const sortIndex = typeof body?.sortIndex === "number" ? body.sortIndex : 0;

  if (!title) {
    const response = jsonErrorWithRequestId("invalid_body", "단원 이름을 입력해주세요.", requestId, 400, {
      hint: "invalid_title",
    });
    logRequest(response.status, { code: "invalid_body", hint: "invalid_title" });
    return response;
  }

  try {
    const section = await createSection({ classId, title, sortIndex });
    const response = jsonOkWithRequestId({ section }, requestId);
    logRequest(response.status, { code: "class_section_created" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "단원을 추가하지 못했습니다.";
    const response = jsonErrorWithRequestId("class_section_create_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_section_create_failed", hint: "unexpected" });
    return response;
  }
}
