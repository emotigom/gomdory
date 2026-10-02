import { NextRequest } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REPLACE_LIMIT = 12;
const MAX_APPEND_LIMIT = 20;
const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_VISIBILITY_FILTER = `${EDU_TABLES.projectVisibility}.${EDU_COLUMNS.hidden}.is.null,${EDU_TABLES.projectVisibility}.${EDU_COLUMNS.hidden}.eq.false`;

type ApplyBody = {
  boardId?: string;
  mode?: "append" | "replace";
  slugs?: string[];
};

type FeaturedRow = {
  slug: string;
  sortOrder: number | null;
  createdAt: string;
};

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as ApplyBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const mode = payload.mode ?? "";
  const rawSlugs = Array.isArray(payload.slugs) ? payload.slugs : [];

  if (!boardId || (mode !== "append" && mode !== "replace")) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId and mode are required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const normalizedSlugs = Array.from(
    new Set(
      rawSlugs
        .map((slug) => slug?.trim().toLowerCase())
        .filter((slug): slug is string => Boolean(slug && SLUG_SAFE_REGEX.test(slug))),
    ),
  );

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

  const allowedLimit = mode === "replace" ? MAX_REPLACE_LIMIT : MAX_APPEND_LIMIT;
  const limitedSlugs = normalizedSlugs.slice(0, allowedLimit);

  let validSlugs: string[] = [];
  if (limitedSlugs.length > 0) {
    const { data: projects, error } = (await supabase
      .from(EDU_TABLES.projects)
      .select([EDU_COLUMNS.slug, `${EDU_TABLES.projectVisibility}(${EDU_COLUMNS.hidden})`].join(", "))
      .eq(EDU_COLUMNS.boardId, boardId)
      .in(EDU_COLUMNS.slug, limitedSlugs)
      .or(PROJECT_VISIBILITY_FILTER)) as { data: Record<string, unknown>[] | null; error: { message: string } | null };

    if (error) {
      void recordOpsEvent(
        {
          level: "error",
          kind: OPS_EVENT_KIND.apiError,
          [OPS_EVENT_FIELDS.requestId]: requestId,
          route: request.nextUrl.pathname,
          status: 400,
          meta: {
            stage: "eduRecommendApply",
            action: "validateProjectsFailed",
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

    validSlugs = (projects ?? [])
      .map((row) => {
        const visibility = row[EDU_TABLES.projectVisibility] as Record<string, unknown> | null | undefined;
        if (visibility?.[EDU_COLUMNS.hidden]) return null;
        return String(row[EDU_COLUMNS.slug] ?? "");
      })
      .filter((slug): slug is string => Boolean(slug));
  }

  let combinedSlugs = validSlugs;
  if (mode === "append") {
    const { data: featured, error: featuredError } = (await supabase
      .from(EDU_TABLES.featuredProjects)
      .select([EDU_COLUMNS.slug, EDU_COLUMNS.sortOrder, EDU_COLUMNS.createdAt].join(", "))
      .eq(EDU_COLUMNS.boardId, boardId)
      .order(EDU_COLUMNS.sortOrder, { ascending: true, nullsFirst: false })
      .order(EDU_COLUMNS.createdAt, { ascending: true })) as { data: FeaturedRow[] | null; error: { message: string } | null };

    if (featuredError) {
      void recordOpsEvent(
        {
          level: "error",
          kind: OPS_EVENT_KIND.apiError,
          [OPS_EVENT_FIELDS.requestId]: requestId,
          route: request.nextUrl.pathname,
          status: 400,
          meta: {
            stage: "eduRecommendApply",
            action: "fetchFeaturedFailed",
            boardId,
            userId,
            message: featuredError.message,
            result: "failed",
          },
        },
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );
      return jsonErrorWithRequestId(
        "FETCH_FAILED",
        featuredError.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }

    const existingSlugs = (featured ?? [])
      .map((row) => String((row as Record<string, unknown>)[EDU_COLUMNS.slug] ?? ""))
      .filter((slug) => Boolean(slug));
    const existingSet = new Set(existingSlugs);
    const additions = validSlugs.filter((slug) => !existingSet.has(slug));
    combinedSlugs = [...existingSlugs, ...additions].slice(0, MAX_APPEND_LIMIT);
  }

  const { error: deleteError } = await supabase
    .from(EDU_TABLES.featuredProjects)
    .delete()
    .eq(EDU_COLUMNS.boardId, boardId);

  if (deleteError) {
    void recordOpsEvent(
      {
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        [OPS_EVENT_FIELDS.requestId]: requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduRecommendApply",
          action: "deleteFailed",
          boardId,
          userId,
          mode,
          message: deleteError.message,
          result: "failed",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId(
      "APPLY_FAILED",
      deleteError.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (combinedSlugs.length > 0) {
    const insertPayload = combinedSlugs.map((slug, index) => ({
      [EDU_COLUMNS.boardId]: boardId,
      [EDU_COLUMNS.slug]: slug,
      [EDU_COLUMNS.sortOrder]: (index + 1) * 10,
    }));

    const { error } = await supabase.from(EDU_TABLES.featuredProjects).insert(insertPayload);

    if (error) {
      void recordOpsEvent(
        {
          level: "error",
          kind: OPS_EVENT_KIND.apiError,
          [OPS_EVENT_FIELDS.requestId]: requestId,
          route: request.nextUrl.pathname,
          status: 400,
          meta: {
            stage: "eduRecommendApply",
            action: "insertFailed",
            boardId,
            userId,
            mode,
            message: error.message,
            result: "failed",
          },
        },
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );
      return jsonErrorWithRequestId(
        "APPLY_FAILED",
        error.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }
  }

  void recordOpsEvent(
    {
      level: "info",
      kind: OPS_EVENT_KIND.apiAccess,
      [OPS_EVENT_FIELDS.requestId]: requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        action: "edu_feature_apply_recommendation",
        boardId,
        userId,
        mode,
        requestedCount: normalizedSlugs.length,
        appliedCount: combinedSlugs.length,
      },
    },
    { sampleRate: 1, hardLimitPerMinute: 120 },
  );

  return jsonOkWithRequestId(
    { ok: true, mode, appliedCount: combinedSlugs.length },
    requestId,
    withNoStoreHeaders(),
  );
}
