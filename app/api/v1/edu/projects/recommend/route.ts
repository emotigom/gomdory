import { NextRequest } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;
const MAX_QUERY_LIMIT = 200;

const STAMP_BONUS: Record<string, number> = {
  "🏅": 25,
  "⭐": 15,
  "👍": 8,
};

const PROJECT_SELECT = [
  EDU_COLUMNS.slug,
  "title",
  EDU_COLUMNS.authorName,
  EDU_COLUMNS.createdAt,
  EDU_COLUMNS.lessonId,
  `${EDU_TABLES.projectStats}(${EDU_COLUMNS.viewCount})`,
  `${EDU_TABLES.projectFeedback}(stamp)`,
  `${EDU_TABLES.projectVisibility}(${EDU_COLUMNS.hidden})`,
].join(", ");
const PROJECT_VISIBILITY_FILTER = `${EDU_TABLES.projectVisibility}.${EDU_COLUMNS.hidden}.is.null,${EDU_TABLES.projectVisibility}.${EDU_COLUMNS.hidden}.eq.false`;

type ProjectEntry = {
  slug: string;
  title: string;
  authorName: string;
  lessonId: number | null;
  createdAt: string;
  viewCount: number;
  stamp: string | null;
  score: number;
  reasons: string[];
  thumbUrl: string;
};

type RecommendRow = Record<string, unknown>;

function buildThumbUrl(slug: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin}/v1/${slug}/thumb.png`;
}

function getRecencyBoost(daysSinceCreated: number) {
  if (daysSinceCreated <= 2) return 10;
  if (daysSinceCreated <= 7) return 6;
  if (daysSinceCreated <= 30) return 2;
  return 0;
}

function getRecencyLabel(daysSinceCreated: number) {
  if (daysSinceCreated <= 2) return "최근 2일 이내";
  if (daysSinceCreated <= 7) return "최근 7일 이내";
  if (daysSinceCreated <= 30) return "최근 30일 이내";
  return "";
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const params = request.nextUrl.searchParams;
  const boardId = params.get("boardId")?.trim() ?? "";

  if (!boardId) {
    return jsonErrorWithRequestId(
      "INVALID_BOARD",
      "boardId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const limitRaw = Number(params.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc(EDU_RPC.boardRole, { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.projects)
    .select(PROJECT_SELECT)
    .eq(EDU_COLUMNS.boardId, boardId)
    .order(EDU_COLUMNS.createdAt, { ascending: false })
    .limit(MAX_QUERY_LIMIT)
    .or(PROJECT_VISIBILITY_FILTER)) as { data: RecommendRow[] | null; error: { message: string } | null };

  if (error) {
    void recordOpsEvent(
      {
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        [OPS_EVENT_FIELDS.requestId]: requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduRecommend",
          action: "recommendFetchFailed",
          boardId,
          userId,
          message: error.message,
          result: "failed",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId(
      "FETCH_FAILED",
      error.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const now = Date.now();
  const items = (data ?? [])
    .map((row) => {
      const stats = row[EDU_TABLES.projectStats] as Record<string, unknown> | null | undefined;
      const feedback = row[EDU_TABLES.projectFeedback] as Record<string, unknown> | null | undefined;
      const visibility = row[EDU_TABLES.projectVisibility] as Record<string, unknown> | null | undefined;
      const slug = String(row[EDU_COLUMNS.slug] ?? "");
      const createdAt = String(row[EDU_COLUMNS.createdAt] ?? "");
      const createdAtTime = createdAt ? new Date(createdAt).getTime() : Number.NaN;
      if (!slug || !Number.isFinite(createdAtTime)) return null;
      if (visibility?.[EDU_COLUMNS.hidden]) return null;

      const viewCount = Number(stats?.[EDU_COLUMNS.viewCount] ?? 0);
      const stamp = (feedback?.["stamp"] as string | null | undefined) ?? null;
      const stampBonus = stamp ? STAMP_BONUS[stamp] ?? 0 : 0;
      const baseScore = Math.log1p(Math.max(0, viewCount)) * 10;
      const daysSinceCreated = Math.max(0, Math.floor((now - createdAtTime) / 86_400_000));
      const recencyBoost = getRecencyBoost(daysSinceCreated);
      const score = baseScore + stampBonus + recencyBoost;

      const reasons = [
        `조회수 ${viewCount.toLocaleString("ko-KR")} → +${baseScore.toFixed(1)}`,
        ...(stampBonus > 0 ? [`선생님 스탬프 ${stamp} +${stampBonus}`] : []),
        ...(recencyBoost > 0 ? [`${getRecencyLabel(daysSinceCreated)} +${recencyBoost}`] : []),
      ];

      return {
        slug,
        title: String(row["title"] ?? ""),
        authorName: String(row[EDU_COLUMNS.authorName] ?? ""),
        lessonId: (row[EDU_COLUMNS.lessonId] as number | null) ?? null,
        createdAt,
        viewCount,
        stamp,
        score: Math.round(score * 10) / 10,
        reasons,
        thumbUrl: buildThumbUrl(slug),
      } satisfies ProjectEntry;
    })
    .filter((item): item is ProjectEntry => Boolean(item));

  const baseSorted = [...items].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.createdAt !== b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.slug.localeCompare(b.slug);
  });

  const lessonCounts = new Map<number | null, number>();
  const ranked = baseSorted.map((item, index) => {
    const count = lessonCounts.get(item.lessonId) ?? 0;
    lessonCounts.set(item.lessonId, count + 1);
    return {
      ...item,
      diversityScore: item.score - count * 0.1,
      baseIndex: index,
    };
  });

  const sorted = ranked
    .sort((a, b) => {
      if (a.diversityScore !== b.diversityScore) return b.diversityScore - a.diversityScore;
      return a.baseIndex - b.baseIndex;
    })
    .slice(0, limit)
    .map((entry) => {
      const { diversityScore, baseIndex, ...item } = entry;
      void diversityScore;
      void baseIndex;
      return item;
    });

  void recordOpsEvent(
    {
      level: "info",
      kind: OPS_EVENT_KIND.apiAccess,
      [OPS_EVENT_FIELDS.requestId]: requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        action: "edu_feature_recommend",
        boardId,
        userId,
        limit,
        itemCount: sorted.length,
      },
    },
    { sampleRate: 1, hardLimitPerMinute: 120 },
  );

  return jsonOkWithRequestId({ items: sorted }, requestId, withNoStoreHeaders());
}
