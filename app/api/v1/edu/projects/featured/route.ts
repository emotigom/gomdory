import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLessonIdFromKey } from "@/lib/edu/gallerySync";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

type FeaturedRow = {
  [key: string]: unknown;
};

const FEATURED_PROJECT_SELECT = [EDU_COLUMNS.slug, EDU_COLUMNS.createdAt, EDU_COLUMNS.sortOrder].join(", ");
const GALLERY_SELECT = [
  EDU_COLUMNS.viewId,
  "title",
  EDU_COLUMNS.authorName,
  EDU_COLUMNS.createdAt,
  EDU_COLUMNS.lessonKey,
  EDU_COLUMNS.previewUrl,
  EDU_COLUMNS.viewCount,
  EDU_COLUMNS.hidden,
  EDU_COLUMNS.hiddenReason,
].join(", ");
const GALLERY_HIDDEN_FILTER = `${EDU_COLUMNS.hidden}.is.null,${EDU_COLUMNS.hidden}.eq.false`;

function buildThumbUrl(slug: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin}/v1/${slug}/thumb.png`;
}

async function resolveBoardId(shareCode: string) {
  const supabase = createSupabaseAdminClient();
  const { data: classRow } = await supabase
    .from(EDU_TABLES.classes)
    .select(EDU_COLUMNS.boardId)
    .eq(EDU_COLUMNS.shareCode, shareCode)
    .maybeSingle();

  const classRowValue = classRow as Record<string, unknown> | null;
  if (classRowValue?.[EDU_COLUMNS.boardId]) {
    return String(classRowValue[EDU_COLUMNS.boardId]);
  }

  const { data: joinCodeRow } = await supabase
    .from(EDU_TABLES.joinCodes)
    .select(EDU_COLUMNS.boardId)
    .eq("code", shareCode)
    .maybeSingle();

  const joinCodeValue = joinCodeRow as Record<string, unknown> | null;
  return (joinCodeValue?.[EDU_COLUMNS.boardId] as string | undefined) ?? null;
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
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

  const limitRaw = Number(params.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  let boardId = boardIdParam;
  if (!boardId && shareCode) {
    boardId = (await resolveBoardId(shareCode)) ?? "";
  }

  if (!boardId) {
    return jsonOkWithRequestId({ items: [], canManage: false, boardId: null }, requestId, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.featuredProjects)
    .select(FEATURED_PROJECT_SELECT)
    .eq(EDU_COLUMNS.boardId, boardId)
    .order(EDU_COLUMNS.sortOrder, { ascending: true, nullsFirst: false })
    .order(EDU_COLUMNS.createdAt, { ascending: false })
    .limit(limit)) as {
    data: FeaturedRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    void recordOpsEvent(
      {
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        [OPS_EVENT_FIELDS.requestId]: requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduGalleryList",
          action: "featuredFetchFailed",
          boardId,
          message: error.message,
          result: "failed",
        },
      },
      { sampleRate: 0.1, hardLimitPerMinute: 120 },
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

  let canManage = false;
  try {
    await requireUserApi();
    const supabaseServer = createSupabaseServerClient();
    const { data: role, error: roleError } = await supabaseServer.rpc(EDU_RPC.boardRole, { bid: boardId });
    const boardRole = normalizeBoardRole(role);
    if (!roleError && boardRole && boardRole !== "viewer") {
      canManage = true;
    }
  } catch {
    canManage = false;
  }

  const featuredSlugs = (data ?? [])
    .map((row) => String(row[EDU_COLUMNS.slug] ?? ""))
    .filter(Boolean);

  const featuredOrder = new Map(
    (data ?? []).map((row) => [
      String(row[EDU_COLUMNS.slug] ?? ""),
      typeof row[EDU_COLUMNS.sortOrder] === "number" ? (row[EDU_COLUMNS.sortOrder] as number) : null,
    ]),
  );

  let galleryRows: Record<string, unknown>[] = [];
  if (featuredSlugs.length > 0) {
    const { data: galleryData, error: galleryError } = (await supabase
      .from(EDU_TABLES.gallery)
      .select(GALLERY_SELECT)
      .in(EDU_COLUMNS.viewId, featuredSlugs)
      .or(GALLERY_HIDDEN_FILTER)) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };

    if (galleryError) {
      return jsonErrorWithRequestId(
        "FETCH_FAILED",
        galleryError.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }

    galleryRows = galleryData ?? [];
  }

  const items = galleryRows
    .map((row) => {
      const slug = String(row[EDU_COLUMNS.viewId] ?? "");
      const previewUrl = row[EDU_COLUMNS.previewUrl] ? String(row[EDU_COLUMNS.previewUrl]) : null;
      return {
        slug,
        title: String(row["title"] ?? ""),
        authorName: String(row[EDU_COLUMNS.authorName] ?? ""),
        lessonId: getLessonIdFromKey(row[EDU_COLUMNS.lessonKey] as string | null),
        createdAt: String(row[EDU_COLUMNS.createdAt] ?? ""),
        viewCount: Number(row[EDU_COLUMNS.viewCount] ?? 0),
        thumbUrl: previewUrl ?? buildThumbUrl(slug),
        isHidden: Boolean(row[EDU_COLUMNS.hidden]),
        hiddenReason: (row[EDU_COLUMNS.hiddenReason] as string | null) ?? null,
        sortOrder: featuredOrder.get(slug) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.sortOrder !== null && b.sortOrder !== null && a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      if (a.sortOrder !== null && b.sortOrder === null) return -1;
      if (a.sortOrder === null && b.sortOrder !== null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return jsonOkWithRequestId({ items, canManage, boardId }, requestId, withNoStoreHeaders());
}
