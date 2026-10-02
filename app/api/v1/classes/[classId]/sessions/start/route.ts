export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { startClassSession } from "@/lib/data/classArchive.server";
import { buildPresentUrl, buildShareUrl } from "@/lib/http/publicLinks";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getLessonTemplate, type LessonTemplate } from "@/lib/lesson-activities/registry";
import { validateSupabaseEnv } from "@/lib/server/env";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  startClassSessionFn?: typeof startClassSession;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const startSession = deps?.startClassSessionFn ?? startClassSession;
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
      "수업을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.",
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

  const body = (await request.json().catch(() => null)) as
    | { boardId?: unknown; sectionId?: unknown; lessonTemplateId?: unknown }
    | null;
  const boardId = typeof body?.boardId === "string" ? body.boardId.trim() : "";
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : null;
  const lessonTemplateIdInput = body?.lessonTemplateId;
  let lessonTemplateId: LessonTemplate["id"] | null = null;
  if (lessonTemplateIdInput !== undefined && lessonTemplateIdInput !== null) {
    if (typeof lessonTemplateIdInput !== "string") {
      const response = jsonErrorWithRequestId(
        "invalid_lesson_template_id",
        "유효한 수업 템플릿을 선택해주세요.",
        requestId,
        400,
        { hint: "invalid_lesson_template_id" },
      );
      logRequest(response.status, { code: "invalid_lesson_template_id", hint: "invalid_lesson_template_id" });
      return response;
    }
    const normalizedTemplateId = lessonTemplateIdInput.trim() as LessonTemplate["id"];
    if (!normalizedTemplateId || !getLessonTemplate(normalizedTemplateId)) {
      const response = jsonErrorWithRequestId(
        "invalid_lesson_template_id",
        "유효한 수업 템플릿을 선택해주세요.",
        requestId,
        400,
        { hint: "invalid_lesson_template_id" },
      );
      logRequest(response.status, { code: "invalid_lesson_template_id", hint: "invalid_lesson_template_id" });
      return response;
    }
    lessonTemplateId = normalizedTemplateId;
  }

  if (!UUID_REGEX.test(boardId)) {
    const response = jsonErrorWithRequestId("invalid_board", "보드를 확인하지 못했습니다.", requestId, 400, {
      hint: "invalid_board",
    });
    logRequest(response.status, { code: "invalid_board", hint: "invalid_board" });
    return response;
  }

  try {
    const session = await startSession({ classId, boardId, sectionId, lessonTemplateId });
    const shareCode = session.share_code;
    const studentUrl = buildShareUrl(shareCode);
    const presentUrl = buildPresentUrl(shareCode);

    const response = jsonOkWithRequestId(
      {
        sessionId: session.id,
        shareCode,
        studentUrl,
        presentUrl,
        boardId,
        sectionId,
        lessonTemplateId: session.lesson_template_id ?? null,
      },
      requestId,
    );
    logRequest(response.status, { code: "class_session_started" });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "수업을 시작하지 못했습니다.";
    const response = jsonErrorWithRequestId("class_session_start_failed", message, requestId, 500, {
      hint: "unexpected",
    });
    logRequest(response.status, { code: "class_session_start_failed", hint: "unexpected" });
    return response;
  }
}
