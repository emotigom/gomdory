import { NextResponse } from "next/server";

import { getBoardFileReadUrl } from "@/lib/data/boardFiles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPayloadPreview } from "@/lib/templates/payloadPreview";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { TemplatePayload } from "@/lib/templates/sanitize";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TemplateDetailDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

type TemplateDetailRow = {
  template_id: string;
  title: string;
  description: string | null;
  tags: string[];
  cover_file_id: string | null;
  stats: Record<string, unknown> | null;
  created_at: string;
  pro_only: boolean;
  picks_rank: number | null;
  tier?: "free" | "pro" | null;
  source?: "community" | "official" | null;
  collection_id?: string | null;
  visibility: "public" | "unlisted" | "hidden";
  owner_user_id: string;
  payload: SanitizedTemplatePayload | TemplatePayload | null;
  moderation: Record<string, unknown> | null;
  grade_band: string | null;
  subject: string | null;
  status?: string | null;
  template_collections?: {
    slug: string;
    title: string;
    tier: "free" | "pro";
  } | null;
} & Record<string, unknown>;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  _requestContext: RequestContext,
  deps?: TemplateDetailDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  let userId: string | null = null;

  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch {
    userId = null;
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return jsonError("invalid_template_id", "템플릿 ID 형식이 올바르지 않습니다.");
  }

  const supabase = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data, error } = await supabase
    .from("templates")
    .select(
      "template_id, title, description, tags, cover_file_id, stats, created_at, pro_only, picks_rank, tier, source, collection_id, visibility, owner_user_id, payload, moderation, grade_band, subject, status, template_collections(slug, title, tier)",
    )
    .eq("template_id", id)
    .maybeSingle<TemplateDetailRow>();

  if (error) {
    return jsonError("template_lookup_failed", error.message, 502);
  }

  if (!data) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  const autoHidden = Boolean((data.moderation as Record<string, unknown> | null | undefined)?.autoHidden);
  if (autoHidden && data.owner_user_id !== userId) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if ((data.status ?? "active") !== "active" && data.owner_user_id !== userId) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if (data.visibility === "hidden" && data.owner_user_id !== userId) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  if (data.visibility !== "public" && data.visibility !== "unlisted" && data.owner_user_id !== userId) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  let versionPayload: SanitizedTemplatePayload | TemplatePayload | null = null;
  let versionPreview: SanitizedTemplatePayload | TemplatePayload | null = null;
  const { data: versionRow } = await supabase
    .from("template_versions")
    .select("payload, payload_preview")
    .eq("template_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: SanitizedTemplatePayload | TemplatePayload | null; payload_preview: SanitizedTemplatePayload | TemplatePayload | null }>();

  versionPayload = (versionRow?.payload ?? null) as SanitizedTemplatePayload | TemplatePayload | null;
  versionPreview = (versionRow?.payload_preview ?? null) as SanitizedTemplatePayload | TemplatePayload | null;

  const resolvedTier = (data.tier ?? (data.pro_only ? "pro" : "free")) as "free" | "pro";
  const basePayload = versionPayload ?? data.payload;
  const payload =
    resolvedTier === "pro"
      ? (versionPreview ?? (basePayload ? buildPayloadPreview(basePayload) : null))
      : basePayload;

  if (!payload) {
    return jsonError("template_not_found", "템플릿을 찾을 수 없습니다.", 404);
  }

  let coverUrl: string | null = null;
  if (data.cover_file_id) {
    const { data: file } = await supabase
      .from("board_files")
      .select("r2_key")
      .eq("id", data.cover_file_id)
      .maybeSingle();
    if (file?.r2_key) {
      try {
        coverUrl = await getBoardFileReadUrl(file.r2_key as string);
      } catch {
        coverUrl = null;
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      template: {
        id: data.template_id as string,
        title: data.title as string,
        description: (data.description as string | null) ?? null,
        tags: (data.tags as string[]) ?? [],
        coverUrl,
        installCount: Number((data.stats as Record<string, unknown> | null | undefined)?.clones ?? 0),
        createdAt: data.created_at as string,
        tier: resolvedTier,
        source: (data.source ?? "community") as "community" | "official",
        accessLevel: resolvedTier,
        isFeatured: data.picks_rank != null,
        featuredRank: data.picks_rank ?? null,
        gradeBand: (data.grade_band as string | null) ?? null,
        subject: (data.subject as string | null) ?? null,
        payload: payload as SanitizedTemplatePayload | TemplatePayload,
        visibility: data.visibility,
        collection: data.template_collections
          ? {
              slug: data.template_collections.slug,
              title: data.template_collections.title,
              tier: data.template_collections.tier,
            }
          : null,
      },
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60" },
    },
  );
}

export const GET = withRequestContext(handleGet);
