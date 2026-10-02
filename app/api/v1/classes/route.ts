export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createClass, listClasses } from "@/lib/data/classes.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  createClassFn?: typeof createClass;
  listClassesFn?: typeof listClasses;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function GET(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const fetchClasses = deps?.listClassesFn ?? listClasses;
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
      "클래스 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  try {
    const classes = await fetchClasses();
    const response = jsonOkWithRequestId({ classes }, requestId);
    logRequest(response.status);
    return response;
  } catch (error) {
    const supabaseErrorCode =
      typeof error === "object" && error && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    const response = jsonErrorWithRequestId(
      "classes_list_failed",
      "클래스 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      requestId,
      502,
      { hint: "unexpected" },
    );
    logRequest(response.status, { code: "classes_list_failed", hint: "unexpected", supabaseErrorCode });
    return response;
  }
}

export async function POST(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const createClassFn = deps?.createClassFn ?? createClass;
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
      "클래스를 만들 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    const response = jsonErrorWithRequestId("invalid_body", "제목을 입력해주세요.", requestId, 400, {
      hint: "invalid_title",
    });
    logRequest(response.status, { code: "invalid_body", hint: "invalid_title" });
    return response;
  }

  try {
    const created = await createClassFn({ title });
    const response = jsonOkWithRequestId({ class: created }, requestId);
    logRequest(response.status, { code: "class_created" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "클래스를 생성하지 못했습니다.";
    const response = jsonErrorWithRequestId("class_create_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_create_failed", hint: "unexpected" });
    return response;
  }
}
