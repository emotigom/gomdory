"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeBoardSummary, type DashboardBoardSummary } from "@/lib/data/boards";
import { createBoard } from "@/lib/data/boards.server";
import { createCard } from "@/lib/data/cards";
import { createWall } from "@/lib/data/walls";
import { getTemplateProState } from "@/lib/data/templateLibrary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getPlanSummaryForUser } from "@/lib/billing/entitlements";

import type { TemplateLibraryItem } from "@/lib/data/templateLibrary";

type TemplatePayload = {
  board?: { title?: string; description?: string | null; initialColumns?: string[] };
  starterCards?: { text: string; column?: string | null }[];
};

export type CreateBoardFromLibraryResult = {
  success: boolean;
  board?: DashboardBoardSummary;
  error?: string;
  status?: number;
};

async function hydrateTemplate(templateId: string): Promise<TemplateLibraryItem | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_library_items")
    .select("*")
    .eq("id", templateId)
    .eq("scope", "community")
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("hydrateTemplate failed", error);
    return null;
  }

  if (!data) return null;

  const basePayload = data.payload as Record<string, unknown>;
  return {
    id: data.id,
    ownerId: data.owner_id,
    scope: data.scope,
    status: data.status,
    title: data.title,
    subtitle: data.subtitle,
    category: data.category,
    gradeBand: data.grade_band,
    durationMin: data.duration_min,
    tags: data.tags ?? [],
    coverKey: data.cover_key,
    payload: basePayload,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    publishedAt: data.published_at,
    installsCount: data.installs_count,
    reportsCount: data.reports_count,
    likesCount: data.likes_count,
    reviewsCount: data.reviews_count,
    avgRating: typeof data.avg_rating === "number" ? data.avg_rating : Number(data.avg_rating ?? 0),
    isPro: Boolean(data.is_pro),
    isPick: Boolean(data.is_pick),
    pickRank: data.pick_rank,
    pickReason:
      typeof basePayload?.meta === "object"
        ? ((basePayload.meta as Record<string, unknown>).pick_reason as string | null)
        : null,
  } satisfies TemplateLibraryItem;
}

async function createBoardFromPayload(payload: TemplatePayload, classId?: string | null) {
  const createdBoard = await createBoard({
    title: payload?.board?.title ?? "새 템플릿 보드",
    description: payload?.board?.description ?? null,
    classId: classId ?? null,
  });

  const summary = normalizeBoardSummary(createdBoard) ?? undefined;
  const columns: string[] = payload?.board?.initialColumns?.length
    ? payload.board.initialColumns
    : ["생각 모으기"];

  const columnMap = new Map<string, string>();

  for (const columnTitle of columns) {
    const wall = await createWall({
      boardId: createdBoard.id,
      title: columnTitle,
      description: null,
    });
    columnMap.set(columnTitle.toLowerCase(), wall.id);
  }

  const defaultWallId = columnMap.values().next().value as string | undefined;

  if (Array.isArray(payload?.starterCards) && payload.starterCards.length) {
    for (const card of payload.starterCards) {
      const lookupKey = typeof card.column === "string" ? card.column.toLowerCase().trim() : null;
      const wallId = lookupKey ? columnMap.get(lookupKey) ?? defaultWallId : defaultWallId;
      if (!wallId) continue;

      await createCard({
        wallId,
        text: card.text,
        boardId: createdBoard.id,
      });
    }
  }

  return summary;
}

export async function createBoardFromLibraryTemplate(
  input: { templateId: string; classId?: string | null },
): Promise<CreateBoardFromLibraryResult> {
  const { user } = await requireUser(`/dashboard/templates/community?template=${input.templateId}`);
  const template = await hydrateTemplate(input.templateId);

  if (!template) {
    return { success: false, error: "템플릿을 찾을 수 없습니다.", status: 404 };
  }

  const plan = await getPlanSummaryForUser(user.id);
  const { enabled, hasAccess } = getTemplateProState(user, plan);
  if (enabled && template.isPro && !hasAccess) {
    return { success: false, error: "Pro 전용 템플릿입니다.", status: 403 };
  }

  try {
    const summary = await createBoardFromPayload(template.payload, input.classId ?? null);
    revalidatePath("/dashboard");
    return { success: true, board: summary };
  } catch (error) {
    console.error("createBoardFromLibraryTemplate failed", error);
    return { success: false, error: "보드를 생성하지 못했습니다." };
  }
}

type EngagementResult = { likesCount: number; reviewsCount: number; avgRating: number; userHasLiked: boolean };

export async function toggleTemplateLike(templateId: string): Promise<EngagementResult | { error: string }> {
  const { user } = await requireUser(`/dashboard/templates/community?template=${templateId}`);
  const supabase = createSupabaseServerClient();

  const existing = await supabase
    .from("template_library_likes")
    .select("template_id")
    .eq("template_id", templateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.data) {
    await supabase.from("template_library_likes").delete().eq("template_id", templateId).eq("user_id", user.id);
  } else {
    await supabase.from("template_library_likes").upsert({ template_id: templateId, user_id: user.id });
  }

  const latest = await supabase
    .from("template_library_items")
    .select("likes_count, reviews_count, avg_rating")
    .eq("id", templateId)
    .maybeSingle();

  return {
    likesCount: latest.data?.likes_count ?? 0,
    reviewsCount: latest.data?.reviews_count ?? 0,
    avgRating: typeof latest.data?.avg_rating === "number"
      ? (latest.data?.avg_rating ?? 0)
      : Number(latest.data?.avg_rating ?? 0),
    userHasLiked: !existing.data,
  };
}

type ReviewResult = {
  reviewsCount: number;
  avgRating: number;
  rating: number;
  comment: string | null;
};

export async function upsertTemplateReview(
  templateId: string,
  rating: number,
  comment: string | null,
): Promise<ReviewResult | { error: string }> {
  const { user } = await requireUser(`/dashboard/templates/community?template=${templateId}`);

  if (rating < 1 || rating > 5) {
    return { error: "평점은 1~5 사이여야 합니다." };
  }

  if (comment && comment.length > 280) {
    return { error: "후기는 280자 이내로 작성해주세요." };
  }

  const supabase = createSupabaseServerClient();
  const lastReview = await supabase
    .from("template_library_reviews")
    .select("created_at")
    .eq("template_id", templateId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  if (lastReview.data?.created_at) {
    const last = new Date(lastReview.data.created_at).getTime();
    if (now - last < 10_000) {
      return { error: "너무 자주 시도하고 있어요. 잠시 후 다시 시도해주세요." };
    }
  }

  const { error } = await supabase.from("template_library_reviews").upsert({
    template_id: templateId,
    user_id: user.id,
    rating,
    comment,
  });

  if (error) {
    console.error("Failed to upsert review", error);
    return { error: "후기를 저장하지 못했습니다." };
  }

  const latest = await supabase
    .from("template_library_items")
    .select("reviews_count, avg_rating")
    .eq("id", templateId)
    .maybeSingle();

  return {
    reviewsCount: latest.data?.reviews_count ?? 0,
    avgRating: typeof latest.data?.avg_rating === "number"
      ? (latest.data?.avg_rating ?? 0)
      : Number(latest.data?.avg_rating ?? 0),
    rating,
    comment,
  };
}

export async function ensureProAccessOrRedirect() {
  const { user } = await requireUser("/dashboard/pro");
  const plan = await getPlanSummaryForUser(user.id);
  const { enabled, hasAccess } = getTemplateProState(user, plan);

  if (enabled && !hasAccess) {
    redirect("/dashboard/templates/community?pro=upgrade");
  }

  return { user, pro: { enabled, hasAccess } };
}
