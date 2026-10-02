import { NextResponse } from "next/server";

import { getBoardFileReadUrl } from "@/lib/data/boardFiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tier: "free" | "pro";
  kind: "picks" | "pro_pack";
  is_locked: boolean;
  badge: string | null;
  cover_image_url: string | null;
  sort_order: number;
  visibility: "public" | "hidden";
};

type TemplateRow = {
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
  grade_band: string | null;
  subject: string | null;
  visibility: "public" | "unlisted" | "hidden";
  moderation: Record<string, unknown> | null;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function fetchCoverUrls(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  fileIds: string[],
): Promise<Record<string, string>> {
  if (fileIds.length === 0) return {};

  const { data, error } = await admin
    .from("board_files")
    .select("id, r2_key")
    .in("id", Array.from(new Set(fileIds)));

  if (error || !data) return {};

  const entries = await Promise.all(
    data.map(async (row) => {
      try {
        const url = await getBoardFileReadUrl(row.r2_key as string);
        return [row.id as string, url] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(Boolean) as Array<[string, string]>);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const supabase = createSupabaseAdminClient();
  const { slug } = await params;

  const { data: collection, error } = await supabase
    .from("template_collections")
    .select("id, slug, title, description, tier, kind, is_locked, badge, cover_image_url, sort_order, visibility")
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle<CollectionRow>();

  if (error) {
    return jsonError("collection_lookup_failed", error.message, 502);
  }

  if (!collection) {
    return jsonError("collection_not_found", "컬렉션을 찾을 수 없습니다.", 404);
  }

  const { data: itemRows, error: itemError } = await supabase
    .from("template_collection_items")
    .select(
      "template_id, rank, note, templates!inner(template_id, title, description, tags, cover_file_id, stats, created_at, pro_only, picks_rank, tier, source, grade_band, subject, visibility, moderation)",
    )
    .eq("collection_id", collection.id)
    .eq("templates.visibility", "public")
    .or("moderation->>autoHidden.is.null,moderation->>autoHidden.eq.false", { foreignTable: "templates" })
    .order("rank", { ascending: true });

  if (itemError) {
    return jsonError("collection_items_failed", itemError.message, 502);
  }

  const rows = (itemRows ?? []) as unknown as Array<{ templates: TemplateRow; rank: number; note: string | null }>;

  const coverIds = rows
    .map((row) => row.templates?.cover_file_id)
    .filter((value): value is string => Boolean(value));
  const coverUrlMap = await fetchCoverUrls(supabase, coverIds);

  const items = rows.map((row) => {
    const template = row.templates;
    const stats = (template?.stats as Record<string, unknown> | null | undefined) ?? {};
    const clones = Number(stats.clones ?? 0);
    return {
      id: template.template_id,
      title: template.title,
      description: template.description ?? null,
      tags: template.tags ?? [],
      coverUrl: template.cover_file_id ? coverUrlMap[template.cover_file_id] ?? null : null,
      installCount: Number.isFinite(clones) ? clones : 0,
      createdAt: template.created_at,
      tier: (template.tier ?? (template.pro_only ? "pro" : "free")) as "free" | "pro",
      source: (template.source ?? "community") as "community" | "official",
      accessLevel: (template.tier ?? (template.pro_only ? "pro" : "free")) as "free" | "pro",
      isFeatured: template.picks_rank != null,
      featuredRank: template.picks_rank ?? null,
      gradeBand: template.grade_band ?? null,
      subject: template.subject ?? null,
      note: row.note ?? null,
      rank: row.rank ?? 0,
    };
  });

  return NextResponse.json({
    ok: true,
    collection: {
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      tier: collection.tier,
      kind: collection.kind,
      isLocked: collection.is_locked || collection.tier === "pro",
      badge: collection.badge,
      coverImageUrl: collection.cover_image_url,
      sortOrder: collection.sort_order,
    },
    items,
    locked: collection.is_locked || collection.tier === "pro",
  });
}
