import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent, type OpsEventKind } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLessonIdFromKey } from "@/lib/edu/gallerySync";
import { getLessonIdFromNumber } from "@/lib/edu/lesson/lessonLock";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const FEATURED_FIRST_SORT = ["featured", "first"].join("_");
const FEATURED_ORDER_SORT = ["featured", "order"].join("_");
const VALID_SORTS = new Set(["newest", "popular", FEATURED_FIRST_SORT, FEATURED_ORDER_SORT, "featured"]);
const GALLERY_SELECT = [
  EDU_COLUMNS.viewId,
  "title",
  EDU_COLUMNS.authorName,
  EDU_COLUMNS.lessonKey,
  EDU_COLUMNS.createdAt,
  EDU_COLUMNS.previewUrl,
  EDU_COLUMNS.viewCount,
  EDU_COLUMNS.hidden,
  EDU_COLUMNS.hiddenReason,
].join(", ");
const GALLERY_TITLE_FIELD = "title";
const GALLERY_AUTHOR_FIELD = EDU_COLUMNS.authorName;
const GALLERY_CREATED_FIELD = EDU_COLUMNS.createdAt;
const GALLERY_LESSON_FIELD = EDU_COLUMNS.lessonKey;
const GALLERY_HIDDEN_FILTER = `${EDU_COLUMNS.hidden}.is.null,${EDU_COLUMNS.hidden}.eq.false`;

type GalleryItem = {
  slug: string;
  title: string;
  authorName: string;
  lessonId: number | null;
  thumbUrl: string | null;
  viewCount: number;
  createdAt: string;
  isHidden: boolean;
  hiddenReason: string | null;
};

type GalleryEventInput = {
  level: "info" | "warn" | "error";
  kind: OpsEventKind;
  requestId: string;
  route: string;
  status: number;
  meta: Record<string, unknown>;
  sampleRate: number;
  hardLimitPerMinute: number;
};

type FeaturedRow = Record<string, unknown>;
type GalleryRow = Record<string, unknown>;

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSearch(value: string | null) {
  if (!value) return "";
  return value.trim();
}

function buildThumbUrl(slug: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin}/v1/${slug}/thumb.png`;
}

const recordGalleryEvent = ({
  level,
  kind,
  requestId,
  route,
  status,
  meta,
  sampleRate,
  hardLimitPerMinute,
}: GalleryEventInput) => {
  void recordOpsEvent(
    {
      level,
      kind,
      [OPS_EVENT_FIELDS.requestId]: requestId,
      route,
      status,
      meta,
    },
    { sampleRate, hardLimitPerMinute },
  );
};

async function resolveBoardId(
  input: { shareCode: string },
  createAdminClient: () => ReturnType<typeof createSupabaseAdminClient>,
) {
  const supabase = createAdminClient();
  const { data: classRow } = await supabase
    .from(EDU_TABLES.classes)
    .select(EDU_COLUMNS.boardId)
    .eq(EDU_COLUMNS.shareCode, input.shareCode)
    .maybeSingle();

  const classRowValue = classRow as Record<string, unknown> | null;
  if (classRowValue?.[EDU_COLUMNS.boardId]) {
    return String(classRowValue[EDU_COLUMNS.boardId]);
  }

  const { data: joinCodeRow } = await supabase
    .from(EDU_TABLES.joinCodes)
    .select(EDU_COLUMNS.boardId)
    .eq("code", input.shareCode)
    .maybeSingle();

  const joinCodeValue = joinCodeRow as Record<string, unknown> | null;
  return (joinCodeValue?.[EDU_COLUMNS.boardId] as string | undefined) ?? null;
}

async function resolveClassCode(
  input: { boardId: string },
  createAdminClient: () => ReturnType<typeof createSupabaseAdminClient>,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(EDU_TABLES.classes)
    .select(EDU_COLUMNS.shareCode)
    .eq(EDU_COLUMNS.boardId, input.boardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as Record<string, unknown> | null;
  return typeof row?.[EDU_COLUMNS.shareCode] === "string" ? String(row?.[EDU_COLUMNS.shareCode]) : null;
}

function mapGalleryRow(row: GalleryRow): GalleryItem {
  const slug = String(row[EDU_COLUMNS.viewId] ?? "");
  const previewUrl = row[EDU_COLUMNS.previewUrl] ? String(row[EDU_COLUMNS.previewUrl]) : null;
  return {
    slug,
    title: String(row["title"] ?? ""),
    authorName: String(row[EDU_COLUMNS.authorName] ?? ""),
    lessonId: getLessonIdFromKey(row[EDU_COLUMNS.lessonKey] as string | null),
    thumbUrl: previewUrl ?? buildThumbUrl(slug),
    viewCount: Number(row[EDU_COLUMNS.viewCount] ?? 0),
    createdAt: String(row[EDU_COLUMNS.createdAt] ?? ""),
    isHidden: Boolean(row[EDU_COLUMNS.hidden]),
    hiddenReason: (row[EDU_COLUMNS.hiddenReason] as string | null) ?? null,
  };
}

export async function handleGet(
  request: NextRequest,
  deps?: {
    createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  },
) {
  const requestId = getOrCreateRequestId(request);
  const createAdminClient = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const params = request.nextUrl.searchParams;
  const boardIdParam = params.get("boardId")?.trim() ?? "";
  const shareCode = normalizeShareCode(params.get("shareCode") ?? "");

  if (!boardIdParam && !isLikelyShareCode(shareCode)) {
    return jsonErrorWithRequestId(
      "INVALID_SHARE_CODE",
      "boardId or shareCode is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const lessonIdRaw = parseNumber(params.get("lessonId"));
  const lessonId = lessonIdRaw && lessonIdRaw >= 0 && lessonIdRaw <= 4 ? lessonIdRaw : null;
  const q = normalizeSearch(params.get("q"));
  const sortParam = params.get("sort") ?? "";
  const normalizedSort = sortParam === "featured" ? FEATURED_FIRST_SORT : sortParam;
  const sort = VALID_SORTS.has(normalizedSort) ? normalizedSort : "newest";
  const includeHiddenRequested = params.get("includeHidden") === "1";

  const limitRaw = parseNumber(params.get("limit"));
  const limit = Math.min(Math.max(limitRaw ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursorRaw = parseNumber(params.get("cursor"));
  const pageRaw = parseNumber(params.get("page"));
  const page = Math.max(cursorRaw ?? pageRaw ?? 0, 0);
  const rangeFrom = page * limit;
  const rangeTo = rangeFrom + limit - 1;

  const fromDateParam = params.get("from");
  const toDateParam = params.get("to");
  const fromDate = fromDateParam ? new Date(fromDateParam) : null;
  const toDate = toDateParam ? new Date(toDateParam) : null;

  const subject = await getRateLimitSubject(request, null);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:gallery:list:${boardIdParam || shareCode || "na"}:${subject}`,
        windowSeconds: 60,
        limit: 60,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    recordGalleryEvent({
      level: "warn",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 429,
      meta: {
        stage: "eduGalleryList",
        action: "rateLimited",
        boardId: boardIdParam,
        shareCode,
        retryAfterSeconds: limitResult.retryAfterSeconds,
      },
      sampleRate: 0.1,
      hardLimitPerMinute: 60,
    });

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rateLimited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  const supabase = createAdminClient();
  const useFeaturedOrder = sort === FEATURED_FIRST_SORT || sort === FEATURED_ORDER_SORT;
  const needsBoardId = includeHiddenRequested || useFeaturedOrder;
  const boardIdResolved = needsBoardId
    ? boardIdParam || (shareCode ? await resolveBoardId({ shareCode }, createAdminClient) : "")
    : boardIdParam;
  const classCode =
    shareCode || (boardIdParam ? await resolveClassCode({ boardId: boardIdParam }, createAdminClient) : null);

  if (!classCode) {
    return jsonOkWithRequestId({ items: [], nextCursor: null }, requestId, withNoStoreHeaders());
  }
  let canIncludeHidden = false;

  if (includeHiddenRequested && boardIdResolved) {
    try {
      await requireUserApi();
      const supabaseServer = createSupabaseServerClient();
      const { data: role, error: roleError } = await supabaseServer.rpc(EDU_RPC.boardRole, { bid: boardIdResolved });
      const boardRole = normalizeBoardRole(role);
      if (!roleError && boardRole && boardRole !== "viewer") {
        canIncludeHidden = true;
      }
    } catch {
      canIncludeHidden = false;
    }
  }

  try {
    if (useFeaturedOrder && boardIdResolved) {
      const featuredRangeEnd = rangeTo;
      const { data: featuredRows, error: featuredError } = (await supabase
        .from(EDU_TABLES.featuredProjects)
        .select([EDU_COLUMNS.slug, EDU_COLUMNS.createdAt, EDU_COLUMNS.sortOrder].join(", "))
        .eq(EDU_COLUMNS.boardId, boardIdResolved)
        .order(EDU_COLUMNS.sortOrder, { ascending: true, nullsFirst: false })
        .order(EDU_COLUMNS.createdAt, { ascending: false })
        .range(0, featuredRangeEnd)) as { data: FeaturedRow[] | null; error: { message: string } | null };

      if (featuredError) {
        throw new Error(featuredError.message);
      }

      const featuredSlugs = (featuredRows ?? [])
        .map((row) => String(row[EDU_COLUMNS.slug] ?? ""))
        .filter(Boolean);

      const featuredOrder = new Map<string, number | null>(
        (featuredRows ?? []).map((row) => [
          String(row[EDU_COLUMNS.slug] ?? ""),
          typeof row[EDU_COLUMNS.sortOrder] === "number" ? (row[EDU_COLUMNS.sortOrder] as number) : null,
        ]),
      );

      let featuredItems: GalleryItem[] = [];
      if (featuredSlugs.length > 0) {
        let featuredQuery = supabase
          .from(EDU_TABLES.gallery)
          .select(GALLERY_SELECT)
          .eq(EDU_COLUMNS.classCode, classCode)
          .in(EDU_COLUMNS.viewId, featuredSlugs);

        if (lessonId) {
          const lessonKey = getLessonIdFromNumber(lessonId);
          if (lessonKey) {
            featuredQuery = featuredQuery.eq(GALLERY_LESSON_FIELD, lessonKey);
          }
        }

        if (fromDate && !Number.isNaN(fromDate.getTime())) {
          featuredQuery = featuredQuery.gte(GALLERY_CREATED_FIELD, fromDate.toISOString());
        }
        if (toDate && !Number.isNaN(toDate.getTime())) {
          featuredQuery = featuredQuery.lte(GALLERY_CREATED_FIELD, toDate.toISOString());
        }

        if (q) {
          const safeQuery = q.replace(/[%_]/g, "\\$&");
          featuredQuery = featuredQuery.or(`${GALLERY_TITLE_FIELD}.ilike.${safeQuery}%,${GALLERY_AUTHOR_FIELD}.ilike.${safeQuery}%`);
        }

        if (!canIncludeHidden) {
          featuredQuery = featuredQuery.or(GALLERY_HIDDEN_FILTER);
        }

        const { data: featuredData, error: featuredDataError } = (await featuredQuery) as {
          data: GalleryRow[] | null;
          error: { message: string } | null;
        };

        if (featuredDataError) {
          throw new Error(featuredDataError.message);
        }

        featuredItems = (featuredData ?? [])
          .map((row) => mapGalleryRow(row))
          .sort((a, b) => {
            const sortA = featuredOrder.get(a.slug) ?? null;
            const sortB = featuredOrder.get(b.slug) ?? null;
            if (sortA !== null && sortB !== null && sortA !== sortB) return sortA - sortB;
            if (sortA !== null && sortB === null) return -1;
            if (sortA === null && sortB !== null) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
      }

      const featuredSlice = featuredItems.slice(rangeFrom, rangeTo + 1);
      const remaining = limit - featuredSlice.length;
      let items = featuredSlice;

      if (remaining > 0) {
        const nonFeaturedOffset = Math.max(rangeFrom - featuredItems.length, 0);
        const nonFeaturedTo = nonFeaturedOffset + remaining - 1;
        let query = supabase
          .from(EDU_TABLES.gallery)
          .select(GALLERY_SELECT)
          .eq(EDU_COLUMNS.classCode, classCode)
          .range(nonFeaturedOffset, nonFeaturedTo);

        if (lessonId) {
          const lessonKey = getLessonIdFromNumber(lessonId);
          if (lessonKey) {
            query = query.eq(GALLERY_LESSON_FIELD, lessonKey);
          }
        }

        if (fromDate && !Number.isNaN(fromDate.getTime())) {
          query = query.gte(GALLERY_CREATED_FIELD, fromDate.toISOString());
        }
        if (toDate && !Number.isNaN(toDate.getTime())) {
          query = query.lte(GALLERY_CREATED_FIELD, toDate.toISOString());
        }

        if (q) {
          const safeQuery = q.replace(/[%_]/g, "\\$&");
          query = query.or(`${GALLERY_TITLE_FIELD}.ilike.${safeQuery}%,${GALLERY_AUTHOR_FIELD}.ilike.${safeQuery}%`);
        }

        if (!canIncludeHidden) {
          query = query.or(GALLERY_HIDDEN_FILTER);
        }

        if (featuredSlugs.length > 0) {
          query = query.not(EDU_COLUMNS.viewId, "in", `(${featuredSlugs.map((slug) => `"${slug}"`).join(",")})`);
        }

        query = query.order(EDU_COLUMNS.createdAt, { ascending: false });

        const { data: nonFeaturedData, error: nonFeaturedError } = (await query) as {
          data: GalleryRow[] | null;
          error: { message: string } | null;
        };

        if (nonFeaturedError) {
          throw new Error(nonFeaturedError.message);
        }

        const nonFeaturedItems = (nonFeaturedData ?? []).map((row) => mapGalleryRow(row));
        items = [...featuredSlice, ...nonFeaturedItems];
      }

      const nextCursor = items.length === limit ? String(page + 1) : null;
      recordGalleryEvent({
        level: "info",
        kind: OPS_EVENT_KIND.apiAccess,
        requestId,
        route: request.nextUrl.pathname,
        status: 200,
        meta: {
          stage: "eduGalleryList",
          action: "fetchOk",
          boardId: boardIdParam,
          shareCode,
          sort,
          itemCount: items.length,
        },
        sampleRate: 0.1,
        hardLimitPerMinute: 120,
      });

      return jsonOkWithRequestId({ items, nextCursor }, requestId, withNoStoreHeaders());
    }

    let query = supabase
      .from(EDU_TABLES.gallery)
      .select(GALLERY_SELECT)
      .eq(EDU_COLUMNS.classCode, classCode)
      .range(rangeFrom, rangeTo);

    if (lessonId) {
      const lessonKey = getLessonIdFromNumber(lessonId);
      if (lessonKey) {
        query = query.eq(GALLERY_LESSON_FIELD, lessonKey);
      }
    }

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      query = query.gte(GALLERY_CREATED_FIELD, fromDate.toISOString());
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      query = query.lte(GALLERY_CREATED_FIELD, toDate.toISOString());
    }

    if (q) {
      const safeQuery = q.replace(/[%_]/g, "\\$&");
      query = query.or(`${GALLERY_TITLE_FIELD}.ilike.${safeQuery}%,${GALLERY_AUTHOR_FIELD}.ilike.${safeQuery}%`);
    }

    if (!canIncludeHidden) {
      query = query.or(GALLERY_HIDDEN_FILTER);
    }

    if (sort === "popular") {
      query = query.order(EDU_COLUMNS.viewCount, { ascending: false, nullsFirst: false });
      query = query.order(EDU_COLUMNS.createdAt, { ascending: false });
    } else {
      query = query.order(EDU_COLUMNS.createdAt, { ascending: false });
    }

    const { data, error } = (await query) as {
      data: GalleryRow[] | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new Error(error.message);
    }

    const items = (data ?? []).map((row) => mapGalleryRow(row));
    const nextCursor = items.length === limit ? String(page + 1) : null;

    recordGalleryEvent({
      level: "info",
      kind: OPS_EVENT_KIND.apiAccess,
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "eduGalleryList",
        action: "fetchOk",
        boardId: boardIdParam,
        shareCode,
        sort,
        itemCount: items.length,
      },
      sampleRate: 0.1,
      hardLimitPerMinute: 120,
    });

    return jsonOkWithRequestId({ items, nextCursor }, requestId, withNoStoreHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetchFailed";

    recordGalleryEvent({
      level: "error",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 400,
      meta: {
        stage: "eduGalleryList",
        action: "fetchFailed",
        boardId: boardIdParam,
        shareCode,
        message,
        result: "failed",
      },
      sampleRate: 0.1,
      hardLimitPerMinute: 120,
    });

    return jsonErrorWithRequestId(
      "FETCH_FAILED",
      message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }
}
