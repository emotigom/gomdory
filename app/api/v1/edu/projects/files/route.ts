import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { presignGetUrl } from "@/lib/r2/client";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COOKIE_NAME = "edu_anon_id";
const SIGNED_URL_TTL_SECONDS = 600;

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const slug = request.nextUrl.searchParams.get("slug")?.trim().toLowerCase() ?? "";

  if (!slug) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("edu_projects")
    .select("id, anon_id, board_id")
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
          stage: "edu_projects_files",
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

  const anonId = request.cookies.get(COOKIE_NAME)?.value?.trim() ?? "";
  const anonMatch = Boolean(anonId && project.anon_id && anonId === project.anon_id);
  let teacherAccess = false;

  if (!anonMatch && project.board_id) {
    try {
      await requireUserApi();
      const server = createSupabaseServerClient();
      const { data: role } = await server.rpc("board_role", { bid: project.board_id });
      const boardRole = normalizeBoardRole(role);
      teacherAccess = Boolean(boardRole && boardRole !== "viewer");
    } catch {
      teacherAccess = false;
    }
  }

  if (!anonMatch && !teacherAccess) {
    return jsonErrorWithRequestId("FORBIDDEN", "forbidden", requestId, 403, undefined, withNoStoreHeaders());
  }

  const { data: files, error: filesError } = await supabase
    .from("edu_project_files")
    .select("path, content_type, size_bytes")
    .eq("project_id", project.id)
    .order("path", { ascending: true });

  if (filesError) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_projects_files",
          action: "files_lookup_failed",
          slug,
          message: filesError.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId("FILES_LOOKUP_FAILED", filesError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const filePayload = await Promise.all(
    (files ?? []).map(async (file) => {
      const url = await presignGetUrl({ key: `edu/v1/${slug}/${file.path}`, expiresSeconds: SIGNED_URL_TTL_SECONDS });
      return {
        path: file.path,
        contentType: file.content_type,
        sizeBytes: file.size_bytes,
        url,
      };
    }),
  );

  return jsonOkWithRequestId({ files: filePayload }, requestId, withNoStoreHeaders());
}
