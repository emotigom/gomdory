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

type FeatureBody = {
  boardId?: string;
  slug?: string;
  featured?: boolean;
};

type FeatureEventInput = {
  level: "info" | "warn" | "error";
  kind: OpsEventKind;
  requestId: string;
  route: string;
  status: number;
  meta: Record<string, unknown>;
  sampleRate: number;
  hardLimitPerMinute: number;
};

const recordFeatureEvent = ({
  level,
  kind,
  requestId,
  route,
  status,
  meta,
  sampleRate,
  hardLimitPerMinute,
}: FeatureEventInput) => {
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

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as FeatureBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const slug = payload.slug?.trim() ?? "";
  const featured = Boolean(payload.featured);

  if (!boardId || !slug || !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId and slug are required",
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
        key: `edu:feature:${boardId}:${subject}`,
        windowSeconds: 60,
        limit: 30,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    recordFeatureEvent({
      level: "warn",
      kind: OPS_EVENT_KIND.apiError,
      requestId,
      route: request.nextUrl.pathname,
      status: 429,
      meta: {
        stage: "eduFeatureToggle",
        action: "rateLimited",
        boardId,
        slug,
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
  if (featured) {
    const sortOrder = Math.floor(Date.now() / 1000);
    const { error } = await supabase
      .from(EDU_TABLES.featuredProjects)
      .upsert({ [EDU_COLUMNS.boardId]: boardId, [EDU_COLUMNS.slug]: slug }, { onConflict: `${EDU_COLUMNS.boardId},${EDU_COLUMNS.slug}` });

    if (error) {
      recordFeatureEvent({
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduFeatureToggle",
          action: "featureOnFailed",
          boardId,
          slug,
          message: error.message,
          result: "failed",
        },
        sampleRate: 1,
        hardLimitPerMinute: 120,
      });

      return jsonErrorWithRequestId(
        "FEATURE_FAILED",
        error.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }

    const { error: sortError } = await supabase
      .from(EDU_TABLES.featuredProjects)
      .update({ [EDU_COLUMNS.sortOrder]: sortOrder })
      .eq(EDU_COLUMNS.boardId, boardId)
      .eq(EDU_COLUMNS.slug, slug)
      .is(EDU_COLUMNS.sortOrder, null);

    if (sortError) {
      recordFeatureEvent({
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduFeatureToggle",
          action: "sortOrderInitFailed",
          boardId,
          slug,
          message: sortError.message,
          result: "failed",
        },
        sampleRate: 1,
        hardLimitPerMinute: 120,
      });

      return jsonErrorWithRequestId(
        "FEATURE_FAILED",
        sortError.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }
  } else {
    const { error } = await supabase
      .from(EDU_TABLES.featuredProjects)
      .delete()
      .eq(EDU_COLUMNS.boardId, boardId)
      .eq(EDU_COLUMNS.slug, slug);

    if (error) {
      recordFeatureEvent({
        level: "error",
        kind: OPS_EVENT_KIND.apiError,
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "eduFeatureToggle",
          action: "featureOffFailed",
          boardId,
          slug,
          message: error.message,
          result: "failed",
        },
        sampleRate: 1,
        hardLimitPerMinute: 120,
      });

      return jsonErrorWithRequestId(
        "FEATURE_FAILED",
        error.message,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }
  }

  recordFeatureEvent({
    level: "info",
    kind: OPS_EVENT_KIND.apiAccess,
    requestId,
    route: request.nextUrl.pathname,
    status: 200,
    meta: {
      stage: "eduFeatureToggle",
      action: featured ? "featureOn" : "featureOff",
      boardId,
      slug,
      result: "ok",
    },
    sampleRate: 1,
    hardLimitPerMinute: 120,
  });

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
