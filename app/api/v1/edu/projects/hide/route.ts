import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getEduVisibilityKv } from "@/lib/edu/visibilityKv";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { toSnakeKeys } from "@/lib/standards/fields";
import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type HideBody = {
  boardId?: string;
  slug?: string;
  hidden?: boolean;
  reason?: string | null;
};

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as HideBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const slug = payload.slug?.trim().toLowerCase() ?? "";
  const hidden = payload.hidden;
  const reason = payload.reason?.trim() ?? "";

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

  if (typeof hidden !== "boolean") {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "hidden is required",
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
  const { data: role, error: roleError } = await supabaseServer.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (!canEditBoard(boardRole)) {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("edu_projects")
    .select("board_id")
    .eq("slug", slug)
    .maybeSingle();

  if (projectError) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "eduProjectHideToggle",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_visibility",
          action: "projectLookupFailed",
          slug,
          boardId,
          message: projectError.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId(
      "PROJECT_LOOKUP_FAILED",
      projectError.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!project) {
    return jsonErrorWithRequestId("PROJECT_NOT_FOUND", "project not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (project.board_id && project.board_id !== boardId) {
    return jsonErrorWithRequestId(
      "BOARD_MISMATCH",
      "boardId does not match",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const now = new Date().toISOString();
  const upsertPayload = toSnakeKeys({
    slug,
    boardId,
    hidden,
    hiddenReason: hidden ? reason || null : null,
    hiddenAt: hidden ? now : null,
    hiddenBy: userId,
  }) as Database["public"]["Tables"]["edu_project_visibility"]["Insert"];

  const { error } = await supabase
    .from("edu_project_visibility")
    .upsert(upsertPayload, { onConflict: "slug" });

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "eduProjectHideToggle",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_visibility",
          action: "upsertFailed",
          slug,
          boardId,
          hidden,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId(
      "VISIBILITY_UPDATE_FAILED",
      error.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const { error: galleryError } = await supabase
    .from(EDU_TABLES.gallery)
    .update(
      toSnakeKeys({
        hidden,
        hiddenReason: hidden ? reason || null : null,
      }) as Database["public"]["Tables"]["edu_gallery"]["Update"],
    )
    .eq(EDU_COLUMNS.viewId, slug);

  if (galleryError) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "eduProjectHideToggle",
        requestId,
        route: request.nextUrl.pathname,
        status: 200,
        meta: {
          stage: "edu_gallery",
          action: "gallery_visibility_sync_failed",
          slug,
          boardId,
          hidden,
          message: galleryError.message,
          result: "partial",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
  }

  const kv = getEduVisibilityKv();
  const kvKey = `edu:hidden:${slug}`;
  if (kv) {
    try {
      if (hidden) {
        await kv.put(kvKey, "1");
      } else {
        await kv.delete(kvKey);
      }
    } catch (kvError) {
      void recordOpsEvent(
        toSnakeKeys({
          level: "warn",
          kind: "eduProjectHideToggle",
          requestId,
          route: request.nextUrl.pathname,
          status: 200,
          meta: {
            stage: "edu_project_visibility",
            action: "kvSyncFailed",
            slug,
            boardId,
            hidden,
            message: kvError instanceof Error ? kvError.message : String(kvError),
            result: "partial",
          },
        }) as Parameters<typeof recordOpsEvent>[0],
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );
    }
  } else {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "eduProjectHideToggle",
        requestId,
        route: request.nextUrl.pathname,
        status: 200,
        meta: {
          stage: "edu_project_visibility",
          action: "kvMissing",
          slug,
          boardId,
          hidden,
          result: "partial",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
  }

  void recordOpsEvent(
    toSnakeKeys({
      level: "info",
      kind: "eduProjectHideToggle",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_project_visibility",
        action: hidden ? "hidden" : "unhidden",
        slug,
        boardId,
        reason: hidden ? reason : null,
        result: "ok",
      },
    }) as Parameters<typeof recordOpsEvent>[0],
    { sampleRate: 1, hardLimitPerMinute: 120 },
  );

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
