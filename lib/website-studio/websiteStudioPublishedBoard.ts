import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type WebsiteStudioPublishedBoardSite = {
  id: string;
  title: string;
  slug: string;
  templateId: string;
  originDay: string | null;
  publishedAt: string | null;
  updatedAt: string;
  safetyStatus: "ready" | "needs-review";
};

type PublishedRow = {
  id: string;
  title: string;
  slug: string;
  template_id: string | null;
  origin_day: string | null;
  published_at: string | null;
  updated_at: string;
  safety_status: "ready" | "needs-review" | null;
};

export async function getPublishedWebsiteStudioSitesForBoard(boardId: string): Promise<WebsiteStudioPublishedBoardSite[]> {
  const normalizedBoardId = boardId.trim();
  if (!normalizedBoardId) return [];
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("website_studio_published_snapshots")
    .select("id,title,slug,template_id,origin_day,published_at,updated_at,safety_status")
    .eq("status", "published")
    .eq("origin_board_id", normalizedBoardId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return (data as PublishedRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    templateId: row.template_id ?? "starter",
    originDay: row.origin_day,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    safetyStatus: row.safety_status === "ready" ? "ready" : "needs-review",
  }));
}
