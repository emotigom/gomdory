import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent, type OpsEventKind } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_DIRECTIONS = new Set(["up", "down", "top"]);

type ReorderBody = {
  boardId?: string;
  slug?: string;
  direction?: "up" | "down" | "top";
};

type FeaturedOrderRow = {
  slug: string;
  sortOrder: number | null;
  createdAt: string;
};

type ReorderEventInput = {
  level: "info" | "warn" | "error";
  kind: OpsEventKind;
  requestId: string;
  route: string;
  status: number;
  meta: Record<string, unknown>;
  sampleRate: number;
  hardLimitPerMinute: number;
};

const recordReorderEvent = ({
  level,
  kind,
  requestId,
  route,
  status,
  meta,
  sampleRate,
  hardLimitPerMinute,
}: ReorderEventInput) => {
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

const moveItem = <T,>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return next;
  next.splice(to, 0, item);
  return next;
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
  const payload = (await request.json().catch(() => null)) as ReorderBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const slug = payload.slug?.trim() ?? "";
  const direction = payload.direction ?? "";

  if (!boardId || !slug || !SLUG_SAFE_REGEX.test(slug) || !VALID_DIRECTIONS.has(direction)) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId, slug, direction are required",
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
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
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
        key: `edu:feature:reorder:${boardId}:${subject}`,
        windowSeconds: 60,
        limit: 30,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    recordReorderEvent({
      level: "warn",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 429,
      meta: {
        stage: "eduFeatureReorder",
        action: "rateLimited",
        boardId,
        slug,
        direction,
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
    recordReorderEvent({
      level: "error",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 400,
      meta: {
        stage: "eduFeatureReorder",
        action: "fetchFailed",
        boardId,
        slug,
        direction,
        message: error.message,
        result: "failed",
      },
      sampleRate: 1,
      hardLimitPerMinute: 120,
    });

    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const items = (data ?? []).map(mapFeaturedOrderRow);
  const currentIndex = items.findIndex((item) => item.slug === slug);

  if (currentIndex < 0) {
    return jsonErrorWithRequestId(
      "NOT_FOUND",
      "featured project not found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let nextIndex = currentIndex;
  if (direction === "up") {
    nextIndex = Math.max(currentIndex - 1, 0);
  } else if (direction === "down") {
    nextIndex = Math.min(currentIndex + 1, items.length - 1);
  } else if (direction === "top") {
    nextIndex = 0;
  }

  if (nextIndex === currentIndex) {
    return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
  }

  const reordered = moveItem(items, currentIndex, nextIndex);
  const updates = reordered.map((item, index) => ({
    [EDU_COLUMNS.boardId]: boardId,
    [EDU_COLUMNS.slug]: item.slug,
    [EDU_COLUMNS.sortOrder]: (index + 1) * 10,
  }));

  const { error: updateError } = await supabase
    .from(EDU_TABLES.featuredProjects)
    .upsert(updates, { onConflict: `${EDU_COLUMNS.boardId},${EDU_COLUMNS.slug}` });

  if (updateError) {
    recordReorderEvent({
      level: "error",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 400,
      meta: {
        stage: "eduFeatureReorder",
        action: "reorderFailed",
        boardId,
        slug,
        direction,
        message: updateError.message,
        result: "failed",
      },
      sampleRate: 1,
      hardLimitPerMinute: 120,
    });

    return jsonErrorWithRequestId(
      "REORDER_FAILED",
      updateError.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  recordReorderEvent({
    level: "info",
    kind: OPS_EVENT_KIND.apiAccess,
    requestId,
    route: request.nextUrl.pathname,
    status: 200,
    meta: {
      stage: "eduFeatureReorder",
      action: "reorderOk",
      boardId,
      slug,
      direction,
      fromIndex: currentIndex,
      toIndex: nextIndex,
      result: "ok",
    },
    sampleRate: 1,
    hardLimitPerMinute: 120,
  });

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
