import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 200;

type PublishStatusRow = {
  author_name: string | null;
  anon_id: string | null;
  title: string | null;
  slug: string;
  publish_state: string;
  publish_state_reason: string | null;
  last_validated_at: string | null;
  last_published_at: string | null;
  public_url: string | null;
  classroom_url: string | null;
  last_request_id: string | null;
  created_at: string;
};

type ProjectStatusResponse = {
  authorName: string | null;
  anonId: string | null;
  title: string | null;
  slug: string;
  publishState: string;
  publishStateReason: string | null;
  lastValidatedAt: string | null;
  lastPublishedAt: string | null;
  publicUrl: string | null;
  classroomUrl: string | null;
  lastRequestId: string | null;
};

function resolveProjectKey(project: PublishStatusRow) {
  return project.anon_id?.trim() || project.author_name?.trim() || project.slug;
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const shareCodeParam = normalizeShareCode(request.nextUrl.searchParams.get("shareCode") ?? "");

  if (!shareCodeParam) {
    return jsonErrorWithRequestId(
      "MISSING_PARAMS",
      "shareCode is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!isLikelyShareCode(shareCodeParam)) {
    return jsonErrorWithRequestId(
      "INVALID_SHARE_CODE",
      "shareCode is invalid",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const admin = createSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("edu_classes")
    .select("board_id")
    .eq("share_code", shareCodeParam)
    .maybeSingle();

  if (classError) {
    return jsonErrorWithRequestId(
      "CLASS_LOOKUP_FAILED",
      classError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!classRow?.board_id) {
    return jsonErrorWithRequestId(
      "CLASS_NOT_FOUND",
      "shareCode not found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc("board_role", { bid: classRow.board_id });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  const { data: projectsData, error: projectsError } = await admin
    .from("edu_projects")
    .select(
      [
        "author_name",
        "anon_id",
        "title",
        "slug",
        "publish_state",
        "publish_state_reason",
        "last_validated_at",
        "last_published_at",
        "public_url",
        "classroom_url",
        "last_request_id",
        "created_at",
      ].join(", "),
    )
    .eq("share_code", shareCodeParam)
    .order("last_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(DEFAULT_LIMIT);
  const projects = (projectsData ?? []) as unknown as PublishStatusRow[];

  if (projectsError) {
    return jsonErrorWithRequestId(
      "PROJECTS_LOOKUP_FAILED",
      projectsError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const seen = new Set<string>();
  const response: ProjectStatusResponse[] = [];

  for (const project of projects) {
    const key = resolveProjectKey(project);
    if (seen.has(key)) continue;
    seen.add(key);
    response.push({
      authorName: project.author_name ?? null,
      anonId: project.anon_id ?? null,
      title: project.title ?? null,
      slug: project.slug,
      publishState: project.publish_state,
      publishStateReason: project.publish_state_reason,
      lastValidatedAt: project.last_validated_at,
      lastPublishedAt: project.last_published_at,
      publicUrl: project.public_url,
      classroomUrl: project.classroom_url,
      lastRequestId: project.last_request_id,
    });
  }

  return jsonOkWithRequestId({ projects: response }, requestId, withNoStoreHeaders());
}
