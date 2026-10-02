import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { buildShowcaseSummary, type ShowcaseSummary } from "@/lib/showcase/buildShowcaseSummary";
import { showcaseToTemplate } from "@/lib/showcase/showcaseToTemplate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TAG_LIMIT = 5;
const TAG_LENGTH = 24;
const TITLE_LENGTH = 120;
const DESCRIPTION_LENGTH = 280;

type TemplateVisibilityInput = "private" | "community";

type TemplateCreateBody = {
  title?: string;
  description?: string | null;
  tags?: string[];
  visibility?: TemplateVisibilityInput;
};

type ShowcaseTemplateDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  showcaseToTemplateFn?: typeof showcaseToTemplate;
  buildShowcaseSummaryFn?: typeof buildShowcaseSummary;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, TAG_LENGTH));
  return Array.from(new Set(cleaned)).slice(0, TAG_LIMIT);
}

function resolveVisibility(value: unknown) {
  return value === "community";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
  deps?: ShowcaseTemplateDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  let userId = "";

  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json().catch(() => null)) as TemplateCreateBody | null;

  const { token } = await params;
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data: tokenRow, error: tokenError } = await admin
    .from("showcase_tokens")
    .select("token, showcase_id, revoked_at")
    .eq("token", token)
    .maybeSingle<{ token: string; showcase_id: string; revoked_at: string | null }>();

  if (tokenError || !tokenRow || tokenRow.revoked_at) {
    return jsonError("showcase_not_found", "쇼케이스를 찾지 못했습니다.", 404);
  }

  const { data: showcase, error: showcaseError } = await admin
    .from("showcases")
    .select("id, owner_id, board_id, is_revoked")
    .eq("id", tokenRow.showcase_id)
    .maybeSingle<{ id: string; owner_id: string; board_id: string; is_revoked: boolean }>();

  if (showcaseError || !showcase || showcase.is_revoked) {
    return jsonError("showcase_not_found", "쇼케이스를 찾지 못했습니다.", 404);
  }

  if (showcase.owner_id !== userId) {
    return jsonError("forbidden", "권한이 없습니다.", 403);
  }

  const buildSummary = deps?.buildShowcaseSummaryFn ?? buildShowcaseSummary;
  let summary: ShowcaseSummary;
  try {
    summary = await buildSummary(showcase.board_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "쇼케이스 요약을 생성하지 못했습니다.";
    return jsonError("showcase_summary_failed", message, 500);
  }

  const titleInput = typeof body?.title === "string" ? body.title.trim() : "";
  const defaultTitle = summary.board.title
    ? `${summary.board.title} (수업 템플릿)`
    : "수업 템플릿";
  const title = (titleInput || defaultTitle).slice(0, TITLE_LENGTH);
  const descriptionInput = typeof body?.description === "string" ? body.description.trim() : "";
  const description = (descriptionInput || "Showcase에서 생성됨").slice(0, DESCRIPTION_LENGTH);
  const visibility = resolveVisibility(body?.visibility);
  const tags = Array.from(new Set(["showcase", "class", ...sanitizeTags(body?.tags)])).slice(0, TAG_LIMIT);

  const buildTemplate = deps?.showcaseToTemplateFn ?? showcaseToTemplate;
  let payload;
  try {
    payload = buildTemplate(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 데이터를 생성하지 못했습니다.";
    return jsonError("template_payload_failed", message, 500);
  }

  const { data: inserted, error: insertError } = await admin
    .from("templates")
    .insert({
      owner_user_id: userId,
      title,
      description,
      grade_band: "mixed",
      subject: "general",
      tags,
      cover_file_id: null,
      visibility: visibility ? "public" : "unlisted",
      pro_only: false,
      picks_rank: null,
      stats: { clones: 0, reports: 0 },
      moderation: { reportCount: 0, autoHidden: false, lastReason: null },
      payload,
    })
    .select("template_id")
    .single();

  if (insertError || !inserted) {
    return jsonError("template_create_failed", insertError?.message ?? "템플릿을 생성하지 못했습니다.", 502);
  }

  return NextResponse.json({ ok: true, templateId: inserted.template_id, url: "/dashboard/templates?created=1" });
}
