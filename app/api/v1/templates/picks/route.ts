import { NextResponse } from "next/server";

import { getBoardFileReadUrl } from "@/lib/data/boardFiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PICK_LIMIT = 12;

type PickDeps = {
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

type TemplatePickRow = {
  rank: number | null;
  templates: {
    template_id: string;
    title: string;
    description: string | null;
    tags: string[] | null;
    cover_file_id: string | null;
    stats: Record<string, unknown> | null;
    created_at: string;
    pro_only: boolean;
    picks_rank: number | null;
    tier?: "free" | "pro" | null;
    source?: "community" | "official" | null;
    visibility: "public" | "unlisted" | "hidden";
    moderation: Record<string, unknown> | null;
  };
  template_collections: {
    kind: "picks" | "pro_pack";
    visibility: "public" | "hidden";
    slug?: string | null;
    title?: string | null;
    tier?: "free" | "pro" | null;
  };
};

function apiError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(_request: Request, _context: unknown, deps?: PickDeps) {
  const supabase = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const { data, error } = await supabase
    .from("template_collection_items")
    .select(
      "rank, templates!inner(template_id, title, description, tags, cover_file_id, stats, created_at, pro_only, picks_rank, tier, source, visibility, moderation), template_collections!inner(kind, visibility, slug, title, tier)",
    )
    .eq("template_collections.kind", "picks")
    .eq("template_collections.visibility", "public")
    .eq("templates.visibility", "public")
    .eq("templates.status", "active")
    .or("moderation->>autoHidden.is.null,moderation->>autoHidden.eq.false", { foreignTable: "templates" })
    .order("rank", { ascending: true })
    .limit(PICK_LIMIT);

  if (error) {
    return apiError("template_pick_failed", error.message, 502);
  }

  const rows = ((data ?? []) as unknown as TemplatePickRow[]);

  const coverIds = rows
    .map((row) => row.templates?.cover_file_id as string | null)
    .filter((value): value is string => Boolean(value));

  const coverMap: Record<string, string> = {};
  if (coverIds.length) {
    const { data: files } = await supabase.from("board_files").select("id, r2_key").in("id", coverIds);
    await Promise.all(
      (files ?? []).map(async (file) => {
        try {
          coverMap[file.id as string] = await getBoardFileReadUrl(file.r2_key as string);
        } catch {
          /* ignore */
        }
      }),
    );
  }

  const items = rows.map((row) => ({
    id: row.templates.template_id as string,
    title: row.templates.title as string,
    description: (row.templates.description as string | null) ?? null,
    tags: (row.templates.tags as string[]) ?? [],
    coverUrl: row.templates.cover_file_id ? coverMap[row.templates.cover_file_id as string] ?? null : null,
    installCount: Number((row.templates.stats as Record<string, unknown> | null | undefined)?.clones ?? 0),
    createdAt: row.templates.created_at as string,
    tier: (row.templates.tier ?? (row.templates.pro_only ? "pro" : "free")) as "free" | "pro",
    source: (row.templates.source ?? "community") as "community" | "official",
    accessLevel: (row.templates.tier ?? (row.templates.pro_only ? "pro" : "free")) as "free" | "pro",
    isFeatured: true,
    featuredRank: (row.templates.picks_rank as number | null) ?? null,
    collection: row.template_collections
      ? {
          slug: row.template_collections.slug ?? "gomdory-picks",
          title: row.template_collections.title ?? "Gomdory Picks",
          tier: (row.template_collections.tier ?? "free") as "free" | "pro",
        }
      : null,
  }));

  return NextResponse.json({ ok: true, items });
}
