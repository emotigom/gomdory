import { NextResponse } from "next/server";

import { getBoardFileReadUrl } from "@/lib/data/boardFiles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_LIMIT = 24;

type TemplateSort = "recent" | "popular";
type TemplateScope = "public" | "mine";

type TemplateListItem = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  installCount: number;
  createdAt: string;
  tier: "free" | "pro";
  source: "community" | "official";
  accessLevel: "free" | "pro";
  isFeatured: boolean;
  featuredRank: number | null;
  gradeBand: string | null;
  subject: string | null;
  collection: { slug: string; title: string; tier: "free" | "pro" } | null;
};

type TemplateListRow = {
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
  visibility?: "public" | "unlisted" | "hidden";
  owner_user_id?: string;
  grade_band: string | null;
  subject: string | null;
  moderation?: Record<string, unknown> | null;
  status?: string | null;
  template_collections?: {
    slug: string;
    title: string;
    tier: "free" | "pro";
  } | null;
} & Record<string, unknown>;

type TemplateCursor =
  | { sort: "recent"; createdAt: string; id: string }
  | { sort: "popular"; installCount: number; createdAt: string; id: string };

type TemplateListDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function decodeCursor(value: string | null, sort: TemplateSort): TemplateCursor | null {
  if (!value) return null;

  const parts = value.split("|");
  if (sort === "recent") {
    const [createdAt, id] = parts;
    if (!createdAt || !id) return null;
    return { sort, createdAt, id };
  }

  const [installCountRaw, createdAt, id] = parts;
  const installCount = Number(installCountRaw);
  if (!Number.isFinite(installCount) || !createdAt || !id) return null;
  return { sort, installCount, createdAt, id };
}

function encodeCursor(last: TemplateListItem | null, sort: TemplateSort): string | null {
  if (!last) return null;
  if (sort === "recent") {
    return `${last.createdAt}|${last.id}`;
  }
  return `${last.installCount}|${last.createdAt}|${last.id}`;
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

async function handleGet(
  request: Request,
  _context: unknown,
  _requestContext: RequestContext,
  deps?: TemplateListDeps,
) {
  const requireUser = deps?.requireUserApiFn ?? requireUserApi;
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? url.searchParams.get("query")?.trim() ?? "";
  const tag = url.searchParams.get("tag")?.trim() ?? "";
  const gradeBandParam = url.searchParams.get("grade")?.trim() ?? url.searchParams.get("gradeBand")?.trim();
  const gradeBand =
    gradeBandParam === "elem" || gradeBandParam === "middle" || gradeBandParam === "mixed"
      ? gradeBandParam
      : null;
  const subject = url.searchParams.get("subject")?.trim() ?? "";
  const tierParam = url.searchParams.get("tier")?.trim() ?? "";
  const collectionParam = url.searchParams.get("collection")?.trim() ?? "";
  const featuredParam = url.searchParams.get("featured")?.trim() ?? "";
  const sortParam = url.searchParams.get("sort");
  const scopeParam = url.searchParams.get("scope");
  const sort: TemplateSort = sortParam === "popular" ? "popular" : "recent";
  const scope: TemplateScope = scopeParam === "mine" ? "mine" : "public";
  const cursorParam = url.searchParams.get("cursor");
  const tier = tierParam === "free" || tierParam === "pro" ? tierParam : "all";
  const featuredOnly = featuredParam === "true";

  const cursor = decodeCursor(cursorParam, sort === "popular" ? "popular" : "recent");
  const supabase = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();

  let userId: string | null = null;
  if (scope === "mine") {
    try {
      const { user } = await requireUser();
      userId = user.id;
    } catch {
      return jsonError("unauthorized", "인증이 필요합니다.", 401);
    }
  } else {
    try {
      const { user } = await requireUser();
      userId = user.id;
    } catch {
      userId = null;
    }
  }

  let builder = supabase
    .from("templates")
    .select(
      "template_id, title, description, tags, cover_file_id, stats, created_at, pro_only, picks_rank, tier, source, collection_id, visibility, owner_user_id, grade_band, subject, moderation, status, template_collections(slug, title, tier)",
    );

  if (scope === "mine" && userId) {
    builder = builder.eq("owner_user_id", userId);
  } else {
    builder = builder.in("visibility", ["public", "unlisted"]);
    builder = builder.eq("status", "active");
    builder = builder.or("moderation->>autoHidden.is.null,moderation->>autoHidden.eq.false");
  }

  if (query) {
    const escaped = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
    builder = builder.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  if (tag) {
    builder = builder.contains("tags", [tag]);
  }

  if (gradeBand) {
    builder = builder.eq("grade_band", gradeBand);
  }

  if (subject) {
    builder = builder.eq("subject", subject);
  }

  if (tier !== "all") {
    builder = builder.eq("tier", tier);
  }

  if (collectionParam) {
    builder = builder.eq("template_collections.slug", collectionParam);
  }

  if (featuredOnly) {
    builder = builder.not("picks_rank", "is", null);
  }

  if (sort === "popular") {
    builder = builder
      .order("stats->>clones", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("template_id", { ascending: false });

    if (cursor && cursor.sort === "popular") {
      builder = builder.or(
        `stats->>clones.lt.${cursor.installCount},and(stats->>clones.eq.${cursor.installCount},created_at.lt.${cursor.createdAt}),and(stats->>clones.eq.${cursor.installCount},created_at.eq.${cursor.createdAt},template_id.lt.${cursor.id})`,
      );
    }
  } else {
    builder = builder.order("created_at", { ascending: false }).order("template_id", { ascending: false });

    if (cursor && cursor.sort === "recent") {
      builder = builder.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},template_id.lt.${cursor.id})`,
      );
    }
  }

  const { data: rawData, error } = await builder.limit(PAGE_LIMIT);

  if (error) {
    return jsonError("template_list_failed", error.message, 502);
  }

  const data = (rawData ?? []) as unknown as TemplateListRow[];
  const coverIds = data
    .map((row) => row.cover_file_id as string | null)
    .filter((value): value is string => Boolean(value));
  const coverUrlMap = await fetchCoverUrls(supabase, coverIds);

  const items = data.map((row) => {
    const stats = (row.stats as Record<string, unknown> | null | undefined) ?? {};
    const clones = Number(stats.clones ?? 0);
    const resolvedTier = (row.tier ?? (row.pro_only ? "pro" : "free")) as "free" | "pro";
    return {
      id: row.template_id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      tags: (row.tags as string[]) ?? [],
      coverUrl: row.cover_file_id ? coverUrlMap[row.cover_file_id as string] ?? null : null,
      installCount: Number.isFinite(clones) ? clones : 0,
      createdAt: row.created_at as string,
      tier: resolvedTier,
      source: ((row.source as string | null) ?? "community") as "community" | "official",
      accessLevel: resolvedTier,
      isFeatured: row.picks_rank != null,
      featuredRank: (row.picks_rank as number | null) ?? null,
      gradeBand: (row.grade_band as string | null) ?? null,
      subject: (row.subject as string | null) ?? null,
      collection: row.template_collections
        ? {
            slug: row.template_collections.slug as string,
            title: row.template_collections.title as string,
            tier: row.template_collections.tier as "free" | "pro",
          }
        : null,
    } satisfies TemplateListItem;
  });

  const nextCursor = items.length === PAGE_LIMIT ? encodeCursor(items[items.length - 1] ?? null, sort) : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}

export const GET = withRequestContext(handleGet);
export { POST } from "./publish/route";
