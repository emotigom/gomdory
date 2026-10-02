import { NextRequest } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent, type OpsEventKind } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

type TrimBody = {
  boardId?: string;
  limit?: number;
};

type FeaturedOrderRow = {
  slug: string;
  sortOrder: number | null;
  createdAt: string;
};

type TrimEventInput = {
  level: "info" | "warn" | "error";
  kind: OpsEventKind;
  requestId: string;
  route: string;
  status: number;
  meta: Record<string, unknown>;
  sampleRate: number;
  hardLimitPerMinute: number;
};

const recordTrimEvent = ({
  level,
  kind,
  requestId,
  route,
  status,
  meta,
  sampleRate,
  hardLimitPerMinute,
}: TrimEventInput) => {
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

const mapFeaturedOrderRow = (row: FeaturedOrderRow): FeaturedOrderRow => {
  const raw = row as unknown as Record<string, unknown>;
  return {
    slug: String(raw[EDU_COLUMNS.slug] ?? ""),
    sortOrder: typeof raw[EDU_COLUMNS.sortOrder] === "number" ? (raw[EDU_COLUMNS.sortOrder] as number) : null,
    createdAt: String(raw[EDU_COLUMNS.createdAt] ?? ""),
  };
};

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as TrimBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const limitRaw = Number(payload.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  if (!boardId) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

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
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "보드를 확인하지 못했습니다.",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  const subject = await getRateLimitSubject(request, userId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:feature:trim:${boardId}:${subject}`,
        windowSeconds: 60,
        limit: 10,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    recordTrimEvent({
      level: "warn",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 429,
      meta: {
        stage: "eduFeatureTrim",
        action: "rateLimited",
        boardId,
        retryAfterSeconds: limitResult.retryAfterSeconds,
      },
      sampleRate: 1,
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

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.featuredProjects)
    .select([EDU_COLUMNS.slug, EDU_COLUMNS.sortOrder, EDU_COLUMNS.createdAt].join(", "))
    .eq(EDU_COLUMNS.boardId, boardId)
    .order(EDU_COLUMNS.sortOrder, { ascending: true, nullsFirst: false })
    .order(EDU_COLUMNS.createdAt, { ascending: false })) as {
    data: FeaturedOrderRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    recordTrimEvent({
      level: "error",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 400,
      meta: {
        stage: "eduFeatureTrim",
        action: "fetchFailed",
        boardId,
        message: error.message,
        result: "failed",
      },
      sampleRate: 1,
      hardLimitPerMinute: 120,
    });

    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const items = (data ?? []).map(mapFeaturedOrderRow);
  const keep = items.slice(0, limit);
  const trim = items.slice(limit);

  if (trim.length > 0) {
    const trimSlugs = trim.map((item) => item.slug).filter(Boolean);
    if (trimSlugs.length > 0) {
      const { error: deleteError } = await supabase
        .from(EDU_TABLES.featuredProjects)
        .delete()
        .eq(EDU_COLUMNS.boardId, boardId)
        .in(EDU_COLUMNS.slug, trimSlugs);

      if (deleteError) {
        recordTrimEvent({
          level: "error",
          kind: OPS_EVENT_KIND.apiError,
          requestId,
          route: request.nextUrl.pathname,
          status: 400,
          meta: {
            stage: "eduFeatureTrim",
            action: "trimFailed",
            boardId,
            message: deleteError.message,
            result: "failed",
          },
          sampleRate: 1,
          hardLimitPerMinute: 120,
        });

        return jsonErrorWithRequestId(
          "TRIM_FAILED",
          deleteError.message,
          requestId,
          400,
          undefined,
          withNoStoreHeaders(),
        );
      }
    }
  }

  const updates = keep.map((item, index) => ({
    [EDU_COLUMNS.boardId]: boardId,
    [EDU_COLUMNS.slug]: item.slug,
    [EDU_COLUMNS.sortOrder]: (index + 1) * 10,
  }));

  if (updates.length > 0) {
    const { error: updateError } = await supabase
      .from(EDU_TABLES.featuredProjects)
      .upsert(updates, { onConflict: `${EDU_COLUMNS.boardId},${EDU_COLUMNS.slug}` });

    if (updateError) {
      recordTrimEvent({
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduFeatureTrim",
          action: "renumberFailed",
          boardId,
          message: updateError.message,
          result: "failed",
        },
        sampleRate: 1,
        hardLimitPerMinute: 120,
      });

      return jsonErrorWithRequestId(
        "TRIM_FAILED",
        updateError.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }
  }

  recordTrimEvent({
    level: "info",
    kind: OPS_EVENT_KIND.apiAccess,
    requestId,
    route: request.nextUrl.pathname,
    status: 200,
    meta: {
      stage: "eduFeatureTrim",
      action: "edu_feature_trim",
      boardId,
      limit,
      keptCount: keep.length,
      trimmedCount: trim.length,
      result: "ok",
    },
    sampleRate: 1,
    hardLimitPerMinute: 120,
  });

  return jsonOkWithRequestId({ ok: true, keptCount: keep.length, trimmedCount: trim.length }, requestId, withNoStoreHeaders());
}
