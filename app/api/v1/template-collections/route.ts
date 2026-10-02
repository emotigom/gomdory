import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CollectionSummary = {
  slug: string;
  title: string;
  description: string | null;
  tier: "free" | "pro";
  kind: "picks" | "pro_pack";
  isLocked: boolean;
  badge: string | null;
  coverImageUrl: string | null;
  sortOrder: number;
};

type CollectionRow = {
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

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("template_collections")
    .select("slug, title, description, tier, kind, is_locked, badge, cover_image_url, sort_order, visibility")
    .eq("visibility", "public")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError("collection_list_failed", error.message, 502);
  }

  const items: CollectionSummary[] = (data as CollectionRow[] | null | undefined ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    tier: row.tier,
    kind: row.kind,
    isLocked: row.is_locked || row.tier === "pro",
    badge: row.badge,
    coverImageUrl: row.cover_image_url,
    sortOrder: row.sort_order,
  }));

  return NextResponse.json({ ok: true, items: items ?? [] });
}
