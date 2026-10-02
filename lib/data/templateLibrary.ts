import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProFeatureEnabled } from "../auth/pro";
import type { BillingPlanSummary } from "@/lib/types/billing";

export type TemplateLibraryItem = {
  id: string;
  ownerId: string;
  scope: string;
  status: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  gradeBand: "ELEM" | "MID" | "ANY";
  durationMin: number | null;
  tags: string[];
  coverKey: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  installsCount: number;
  reportsCount: number;
  likesCount: number;
  reviewsCount: number;
  avgRating: number;
  isPro: boolean;
  isPick: boolean;
  pickRank: number | null;
  pickReason: string | null;
};

export type TemplateEngagementState = {
  likedTemplateIds: Set<string>;
  reviewsByTemplate: Map<string, { rating: number; comment: string | null; createdAt: string }>;
};

function mapTemplateRecord(record: Record<string, unknown>): TemplateLibraryItem {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const pickReason =
    typeof payload?.meta === "object" && payload.meta
      ? ((payload.meta as Record<string, unknown>).pick_reason as string | null | undefined)
      : null;

  return {
    id: record.id as string,
    ownerId: record.owner_id as string,
    scope: record.scope as string,
    status: record.status as string,
    title: record.title as string,
    subtitle: record.subtitle as string | null,
    category: record.category as string | null,
    gradeBand: record.grade_band as TemplateLibraryItem["gradeBand"],
    durationMin: record.duration_min as number | null,
    tags: (record.tags as string[]) ?? [],
    coverKey: record.cover_key as string | null,
    payload,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
    publishedAt: record.published_at as string | null,
    installsCount: record.installs_count as number,
    reportsCount: record.reports_count as number,
    likesCount: record.likes_count as number,
    reviewsCount: record.reviews_count as number,
    avgRating: typeof record.avg_rating === "number" ? record.avg_rating : Number(record.avg_rating ?? 0),
    isPro: Boolean(record.is_pro),
    isPick: Boolean(record.is_pick),
    pickRank: record.pick_rank as number | null,
    pickReason: pickReason ?? null,
  };
}

async function fetchEngagement(
  supabase: Pick<SupabaseClient, "from">,
  user: User | null,
): Promise<TemplateEngagementState> {
  if (!user) {
    return { likedTemplateIds: new Set<string>(), reviewsByTemplate: new Map<string, { rating: number; comment: string | null; createdAt: string }>() };
  }

  const [likesRes, reviewsRes] = await Promise.all([
    supabase.from("template_library_likes").select("template_id").eq("user_id", user.id),
    supabase
      .from("template_library_reviews")
      .select("template_id, rating, comment, created_at")
      .eq("user_id", user.id),
  ]);

  const likedTemplateIds = new Set<string>((likesRes.data ?? []).map((row) => row.template_id));
  const reviewsByTemplate = new Map<string, { rating: number; comment: string | null; createdAt: string }>();

  for (const row of reviewsRes.data ?? []) {
    reviewsByTemplate.set(row.template_id, {
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
    });
  }

  return { likedTemplateIds, reviewsByTemplate };
}

export async function fetchCommunityTemplates(user: User | null) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_library_items")
    .select("*")
    .eq("scope", "community")
    .eq("status", "published")
    .order("is_pick", { ascending: false })
    .order("pick_rank", { ascending: true })
    .order("installs_count", { ascending: false });

  if (error) {
    console.error("Failed to fetch community templates", error);
    return {
      templates: [],
      engagement: {
        likedTemplateIds: new Set<string>(),
        reviewsByTemplate: new Map<string, { rating: number; comment: string | null; createdAt: string }>(),
      },
    };
  }

  const engagement = await fetchEngagement(supabase, user);

  return {
    templates: (data ?? []).map(mapTemplateRecord),
    engagement,
  };
}

export async function fetchProTemplates(user: User | null) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_library_items")
    .select("*")
    .eq("scope", "community")
    .eq("status", "published")
    .eq("is_pro", true)
    .order("pick_rank", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch pro templates", error);
    return {
      templates: [],
      engagement: {
        likedTemplateIds: new Set<string>(),
        reviewsByTemplate: new Map<string, { rating: number; comment: string | null; createdAt: string }>(),
      },
    };
  }

  const engagement = await fetchEngagement(supabase, user);
  return { templates: (data ?? []).map(mapTemplateRecord), engagement };
}

export function getTemplateProState(user: User | null, plan?: BillingPlanSummary) {
  const enabled = isProFeatureEnabled();
  const hasAccess = plan ? plan.plan === "pro" : false;
  return { enabled, hasAccess };
}
