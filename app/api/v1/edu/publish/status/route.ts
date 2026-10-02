import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublishStatusRow = Pick<
  Database["public"]["Tables"]["edu_projects"]["Row"],
  | "publish_state"
  | "publish_state_reason"
  | "last_validated_at"
  | "last_published_at"
  | "preview_url"
  | "public_url"
  | "classroom_url"
  | "last_request_id"
>;

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const slugParam = request.nextUrl.searchParams.get("slug");
  const projectIdParam = request.nextUrl.searchParams.get("projectId");
  const slug = slugParam?.trim().toLowerCase() ?? "";
  const projectId = projectIdParam?.trim() ?? "";

  if (!slug && !projectId) {
    return jsonErrorWithRequestId(
      "INVALID_QUERY",
      "slug or projectId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (slug && !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is invalid", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!slug && projectId && !PROJECT_ID_REGEX.test(projectId)) {
    return jsonErrorWithRequestId(
      "INVALID_PROJECT_ID",
      "projectId is invalid",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: projectData, error: projectError } = await supabase
    .from("edu_projects")
    .select(
      [
        "publish_state",
        "publish_state_reason",
        "last_validated_at",
        "last_published_at",
        "preview_url",
        "public_url",
        "classroom_url",
        "last_request_id",
      ].join(", "),
    )
    .eq(slug ? "slug" : "id", slug || projectId)
    .returns<PublishStatusRow>()
    .maybeSingle();
  const project = projectData as PublishStatusRow | null;

  if (projectError) {
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

  return jsonOkWithRequestId(
    {
      state: project.publish_state,
      reasonCode: project.publish_state_reason,
      lastValidatedAt: project.last_validated_at,
      lastPublishedAt: project.last_published_at,
      links: {
        previewUrl: project.preview_url,
        publicUrl: project.public_url,
        classroomUrl: project.classroom_url,
      },
      requestId: project.last_request_id,
    },
    requestId,
    withNoStoreHeaders(),
  );
}
