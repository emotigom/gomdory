import { NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { apiErrorResponse } from "@/lib/http/apiError";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { safeStudentText } from "@/lib/safety/safeStudentText";
import { exportBoardTemplate } from "@/lib/templates/exportBoardTemplate";
import { buildPayloadPreview } from "@/lib/templates/payloadPreview";
import { buildTemplatePreview, sanitizeTemplatePayload, type TemplatePayload } from "@/lib/templates/sanitize";
import { validateTemplatePayload } from "@/lib/templates/validate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TAG_LIMIT = 8;
const TAG_LENGTH = 24;

const TITLE_LENGTH = 40;
const DESCRIPTION_LENGTH = 240;
const SUBJECT_LENGTH = 32;
const COVER_ID_LENGTH = 64;

type TemplatePublishDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  exportBoardTemplateFn?: typeof exportBoardTemplate;
  sanitizeTemplatePayloadFn?: typeof sanitizeTemplatePayload;
  buildTemplatePreviewFn?: typeof buildTemplatePreview;
  validateTemplatePayloadFn?: typeof validateTemplatePayload;
};

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, TAG_LENGTH));
  return Array.from(new Set(cleaned)).slice(0, TAG_LIMIT);
}

function sanitizeGradeBand(value: unknown): "elem" | "middle" | "mixed" {
  return value === "middle" || value === "mixed" ? value : "elem";
}

function sanitizeSubject(value: unknown): string {
  if (typeof value !== "string") return "general";
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, SUBJECT_LENGTH) : "general";
}

function sanitizeAccess(value: unknown): "free" | "pro" {
  return value === "pro" ? "pro" : "free";
}

async function handlePost(
  request: Request,
  _context: unknown,
  requestContext: RequestContext,
  deps?: TemplatePublishDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  let userId = "";
  const requestId = requestContext.requestId;

  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch {
    return apiErrorResponse("unauthorized", "인증이 필요합니다.", 401, { requestId });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        boardId?: string;
        title?: string;
        description?: string | null;
        tags?: string[];
        coverFileId?: string | null;
        gradeBand?: "elem" | "middle" | "mixed";
        subject?: string;
        visibility?: "public" | "unlisted" | "hidden";
        access?: "free" | "pro";
      }
    | null;

  if (!body?.boardId || !UUID_REGEX.test(body.boardId)) {
    return apiErrorResponse("invalid_board_id", "보드 ID를 확인해주세요.", 400, { requestId });
  }

  const rawTitle = typeof body.title === "string" ? body.title : "";
  const titleSafe = safeStudentText(rawTitle, { maxLength: TITLE_LENGTH });
  if (!titleSafe.text) {
    return apiErrorResponse("invalid_title", "템플릿 제목을 입력해주세요.", 400, { requestId });
  }

  const title = titleSafe.text;
  const descriptionSafe =
    typeof body.description === "string"
      ? safeStudentText(body.description, { maxLength: DESCRIPTION_LENGTH })
      : null;
  const description = descriptionSafe?.text ?? null;
  const tags = sanitizeTags(body.tags);
  const coverFileId =
    typeof body.coverFileId === "string" && body.coverFileId.trim()
      ? body.coverFileId.trim().slice(0, COVER_ID_LENGTH)
      : null;
  if (coverFileId && !UUID_REGEX.test(coverFileId)) {
    return apiErrorResponse("invalid_cover", "커버 파일을 확인해주세요.", 400, { requestId });
  }
  const gradeBand = sanitizeGradeBand(body.gradeBand);
  const subject = sanitizeSubject(body.subject);
  const visibility = body.visibility === "unlisted" ? body.visibility : "public";
  const access = sanitizeAccess(body.access);

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: body.boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !canEditBoard(boardRole)) {
    return apiErrorResponse("forbidden", "보드에 접근할 권한이 없습니다.", 403, { requestId });
  }

  const exportFn = deps?.exportBoardTemplateFn ?? exportBoardTemplate;
  const sanitizeFn = deps?.sanitizeTemplatePayloadFn ?? sanitizeTemplatePayload;
  const previewFn = deps?.buildTemplatePreviewFn ?? buildTemplatePreview;
  const validateFn = deps?.validateTemplatePayloadFn ?? validateTemplatePayload;

  let sanitizedPayload: TemplatePayload;
  let preview;
  let payloadPreview: TemplatePayload | null = null;
  try {
    const boardExport = await exportFn(body.boardId);
    sanitizedPayload = sanitizeFn(boardExport, {
      title,
      description,
      tags,
    });
    validateFn(sanitizedPayload);
    preview = previewFn(sanitizedPayload);
    payloadPreview = buildPayloadPreview(sanitizedPayload) as TemplatePayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 데이터를 준비하지 못했습니다.";
    return apiErrorResponse("template_export_failed", message, 500, { requestId });
  }

  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data: inserted, error } = await admin
    .from("templates")
    .insert({
      owner_user_id: userId,
      title,
      description: description ?? "",
      grade_band: gradeBand,
      subject,
      tags,
      cover_file_id: coverFileId,
      visibility,
      pro_only: access === "pro",
      picks_rank: null,
      stats: { clones: 0, reports: 0 },
      moderation: { reportCount: 0, autoHidden: false, lastReason: null },
      payload: sanitizedPayload,
      status: "active",
      report_count: 0,
      copy_count: 0,
      last_reported_at: null,
    })
    .select("template_id")
    .single();

  if (error || !inserted) {
    return apiErrorResponse("template_publish_failed", error?.message ?? "템플릿을 게시하지 못했습니다.", 502, {
      requestId,
    });
  }

  if (preview) {
    await admin.from("template_versions").insert({
      template_id: inserted.template_id,
      schema_version: sanitizedPayload.schemaVersion,
      payload: sanitizedPayload,
      preview,
      payload_preview: payloadPreview,
    });
  }

  return NextResponse.json({ ok: true, templateId: inserted.template_id, requestId });
}

export const POST = withRequestContext(handlePost);
