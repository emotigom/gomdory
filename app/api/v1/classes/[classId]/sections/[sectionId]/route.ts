export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { updateClassSection } from "@/lib/data/classArchive.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  updateClassSectionFn?: typeof updateClassSection;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; sectionId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const updateSection = deps?.updateClassSectionFn ?? updateClassSection;
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
      "단원을 수정할 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  const { classId, sectionId } = await params;
  if (!classId || !sectionId) {
    const response = jsonErrorWithRequestId("invalid_section", "단원을 확인하지 못했습니다.", requestId, 400, {
      hint: "invalid_section",
    });
    logRequest(response.status, { code: "invalid_section", hint: "invalid_section" });
    return response;
  }

  const body = (await request.json().catch(() => null)) as { title?: unknown; sortIndex?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : undefined;
  const sortIndex = typeof body?.sortIndex === "number" ? body.sortIndex : undefined;

  if (!title && typeof sortIndex !== "number") {
    const response = jsonErrorWithRequestId("invalid_body", "수정할 내용을 입력해주세요.", requestId, 400, {
      hint: "invalid_body",
    });
    logRequest(response.status, { code: "invalid_body", hint: "invalid_body" });
    return response;
  }

  try {
    const section = await updateSection({ classId, sectionId, title, sortIndex });
    const response = jsonOkWithRequestId({ section }, requestId);
    logRequest(response.status, { code: "class_section_updated" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "단원을 수정하지 못했습니다.";
    const response = jsonErrorWithRequestId("class_section_update_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_section_update_failed", hint: "unexpected" });
    return response;
  }
}
