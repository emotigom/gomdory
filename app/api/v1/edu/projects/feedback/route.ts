import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_STAMPS = new Set(["👍", "⭐", "🏅"]);

type FeedbackBody = {
  boardId?: string;
  slug?: string;
  stamp?: string | null;
  comment?: string | null;
};

type FeedbackRow = {
  stamp: string | null;
  comment: string | null;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const slug = request.nextUrl.searchParams.get("slug")?.trim().toLowerCase() ?? "";

  if (!slug || !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from("edu_project_feedback")
    .select("stamp, comment, updated_at")
    .eq("slug", slug)
    .maybeSingle()) as { data: FeedbackRow | null; error: { message: string } | null };

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_feedback",
          action: "fetch_failed",
          slug,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(
      "FEEDBACK_FETCH_FAILED",
      error.message,
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  return jsonOkWithRequestId(
    {
      feedback: data
        ? {
            stamp: data.stamp,
            comment: data.comment,
            updatedAt: data.updated_at,
          }
        : null,
    },
    requestId,
    withNoStoreHeaders(),
  );
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as FeedbackBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const slug = payload.slug?.trim().toLowerCase() ?? "";

  if (!boardId) {
    return jsonErrorWithRequestId("INVALID_BOARD", "boardId is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!slug || !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  let userId: string;
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

  if (boardRole === "viewer") {
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
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_feedback",
          action: "project_lookup_failed",
          slug,
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

  const trimmedComment = payload.comment?.trim() ?? "";
  const comment = trimmedComment ? trimmedComment : null;
  const rawStamp = payload.stamp?.trim() ?? "";

  if (rawStamp && !ALLOWED_STAMPS.has(rawStamp)) {
    return jsonErrorWithRequestId("INVALID_STAMP", "invalid stamp", requestId, 400, undefined, withNoStoreHeaders());
  }

  const stamp = rawStamp ? rawStamp : null;

  const upsertPayload = toSnakeKeys({
    slug,
    boardId,
    teacherUserId: userId,
    stamp,
    comment,
    updatedAt: new Date().toISOString(),
  }) as Database["public"]["Tables"]["edu_project_feedback"]["Insert"];

  const { error } = await supabase.from("edu_project_feedback").upsert(upsertPayload, { onConflict: "slug" });

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_project_feedback",
          action: "upsert_failed",
          slug,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId("FEEDBACK_SAVE_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
