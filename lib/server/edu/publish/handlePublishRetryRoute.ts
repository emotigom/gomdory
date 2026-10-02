import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getRequestOrigin } from "@/lib/http/requestHost";
import { getR2TargetMeta, headObject, listObjectKeysV2 } from "@/lib/r2/client";
import { getEduProjectExpiresAt } from "@/lib/edu/expiration";
import { validateEduPublishFiles } from "@/lib/edu/validateFiles";
import { fileMissingExtra } from "@/lib/edu/publish/fileMissingDiagnostics";
import {
  buildAtomicPublishPayload,
  buildDbFunctionBugExtra,
  EDU_ATOMIC_PUBLISH_RPC_V2,
  resolveInSlug,
} from "@/lib/edu/publish/publishRpc";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_MISSING_LIST_MAX_KEYS = 200;
const FILE_MISSING_SAMPLE_MAX = 20;

type RetryBody = {
  slug?: string;
  projectId?: string;
  project_id?: string;
};

type ProjectRow = Database["public"]["Tables"]["edu_projects"]["Row"];
type EduProjectUpdatePayload = Database["public"]["Tables"]["edu_projects"]["Update"];
type PublishProjectRow = Pick<
  ProjectRow,
  | "id"
  | "slug"
  | "publish_state"
  | "publish_state_reason"
  | "last_validated_at"
  | "last_published_at"
  | "public_url"
  | "classroom_url"
  | "last_request_id"
>;

type PublishStateResponse = {
  id: string;
  slug: string;
  publishState: string;
  publishStateReason: string | null;
  lastValidatedAt: string | null;
  lastPublishedAt: string | null;
  publicUrl: string | null;
  classroomUrl: string | null;
  lastRequestId: string | null;
};

function buildPublishLinks(origin: string, slug: string) {
  const publicUrl = new URL(`/edu/view/${slug}/`, origin);
  const previewUrl = new URL(`/edu/view/${slug}/`, origin);
  previewUrl.searchParams.set("preview", "1");
  const classroomUrl = new URL(`/edu/view/${slug}/`, origin);
  classroomUrl.searchParams.set("classroom", "1");

  return {
    previewUrl: previewUrl.toString(),
    publicUrl: publicUrl.toString(),
    classroomUrl: classroomUrl.toString(),
  };
}

function buildGalleryPreviewUrl(slug: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin.replace(/\/$/, "")}/v1/${slug}/thumb.png`;
}

async function insertPublishEvent({
  supabase,
  projectId,
  state,
  reasonCode,
  requestId,
  meta,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  projectId: string;
  state: string;
  reasonCode?: string | null;
  requestId: string;
  meta?: Record<string, unknown>;
}) {
  const payload = {
    project_id: projectId,
    state,
    reason_code: reasonCode ?? null,
    meta: meta ?? {},
    request_id: requestId,
  } satisfies Database["public"]["Tables"]["publish_events"]["Insert"];

  const { error } = await supabase.from("publish_events").insert(payload);
  if (error) throw new Error(error.message);
}

function buildPublishResponse(project: PublishProjectRow): PublishStateResponse {
  return {
    id: project.id,
    slug: project.slug,
    publishState: project.publish_state,
    publishStateReason: project.publish_state_reason,
    lastValidatedAt: project.last_validated_at,
    lastPublishedAt: project.last_published_at,
    publicUrl: project.public_url,
    classroomUrl: project.classroom_url,
    lastRequestId: project.last_request_id,
  };
}

async function loadProject({
  supabase,
  slug,
  projectId,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  slug: string;
  projectId: string;
}) {
  return supabase.from("edu_projects").select("*").eq(slug ? "slug" : "id", slug || projectId).maybeSingle();
}

export async function handlePublishRetryRoute({
  request,
  requestId,
  payload,
}: {
  request: NextRequest;
  requestId: string;
  payload: unknown;
} ): Promise<Response> {
  const supabaseUrl = readEnvString("SUPABASE_URL") ?? "";
  const supabaseRef = (() => {
    try {
      return new URL(supabaseUrl).host.split(".")[0] || "unknown";
    } catch {
      return "unknown";
    }
  })();

  const body = (payload ?? null) as RetryBody | null;
  const slug = body?.slug?.trim().toLowerCase() ?? "";
  const projectId = (body?.projectId ?? body?.project_id)?.trim() ?? "";

  if (!slug && !projectId) {
    return jsonErrorWithRequestId("INVALID_BODY", "slug or projectId is required", requestId, 400, undefined, withNoStoreHeaders());
  }
  if (slug && !SLUG_SAFE_REGEX.test(slug)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "slug is invalid", requestId, 400, undefined, withNoStoreHeaders());
  }
  if (!slug && projectId && !PROJECT_ID_REGEX.test(projectId)) {
    return jsonErrorWithRequestId("INVALID_PROJECT_ID", "projectId is invalid", requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data: project, error: projectError } = await loadProject({ supabase, slug, projectId });
  if (projectError) {
    return jsonErrorWithRequestId("PROJECT_LOOKUP_FAILED", projectError.message, requestId, 400, undefined, withNoStoreHeaders());
  }
  if (!project) {
    return jsonErrorWithRequestId("PROJECT_NOT_FOUND", "project not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  let boardId = project.board_id;
  if (!boardId && project.share_code) {
    const { data: classRow } = await supabase.from("edu_classes").select("board_id").eq("share_code", project.share_code).maybeSingle();
    boardId = classRow?.board_id ?? null;
  }
  if (!boardId) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
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

  const { data: galleryRow, error: galleryError } = await supabase.from("edu_gallery").select("id").eq("view_id", project.slug).maybeSingle();
  if (galleryError) {
    return jsonErrorWithRequestId("GALLERY_LOOKUP_FAILED", galleryError.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  if (project.publish_state !== "FAILED" && !galleryRow) {
    const galleryPayload = toSnakeKeys({
      classCode: project.share_code,
      viewId: project.slug,
      lessonKey: project.lesson_id ? `P${project.lesson_id}` : null,
      title: project.title,
      authorName: project.author_name,
      previewUrl: buildGalleryPreviewUrl(project.slug),
    }) as Database["public"]["Tables"]["edu_gallery"]["Insert"];
    const { error: galleryUpsertError } = await supabase.from("edu_gallery").upsert(galleryPayload, { onConflict: "view_id" });
    if (galleryUpsertError) {
      return jsonErrorWithRequestId("GALLERY_REPAIR_FAILED", galleryUpsertError.message, requestId, 500, undefined, withNoStoreHeaders());
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from("edu_projects")
      .update(toSnakeKeys({ publishState: "PUBLISHED", publishStateReason: null, lastPublishedAt: new Date().toISOString(), lastRequestId: requestId }) as EduProjectUpdatePayload)
      .eq("id", project.id)
      .select("id,slug,publish_state,publish_state_reason,last_validated_at,last_published_at,public_url,classroom_url,last_request_id")
      .returns<PublishProjectRow>()
      .single();

    if (updateError || !updatedProject) {
      return jsonErrorWithRequestId("PUBLISH_STATE_FAILED", updateError?.message ?? "publish_state_failed", requestId, 500, undefined, withNoStoreHeaders());
    }

    try {
      await insertPublishEvent({ supabase, projectId: project.id, state: "PUBLISHED", requestId, meta: { slug: project.slug, shareCode: project.share_code, repair: true } });
    } catch {
      // ignore
    }

    return jsonOkWithRequestId({ project: buildPublishResponse(updatedProject) }, requestId, withNoStoreHeaders());
  }

  if (project.publish_state !== "FAILED") {
    return jsonOkWithRequestId({ project: buildPublishResponse(project) }, requestId, withNoStoreHeaders());
  }

  const { data: files, error: filesError } = await supabase.from("edu_project_files").select("path, content_type, size_bytes").eq("project_id", project.id);
  if (filesError) return jsonErrorWithRequestId("FILES_LOOKUP_FAILED", filesError.message, requestId, 500, undefined, withNoStoreHeaders());

  const validation = validateEduPublishFiles((files ?? []).map((file) => ({ path: file.path, contentType: file.content_type, sizeBytes: file.size_bytes })));
  if (!validation.ok) {
    await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "FAILED", publishStateReason: validation.code, lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
    return jsonErrorWithRequestId(validation.code, validation.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const { error: validatingError } = await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "VALIDATING", publishStateReason: null, lastValidatedAt: new Date().toISOString(), lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
  if (validatingError) return jsonErrorWithRequestId("PUBLISH_STATE_FAILED", validatingError.message, requestId, 500, undefined, withNoStoreHeaders());

  try {
    await insertPublishEvent({ supabase, projectId: project.id, state: "VALIDATING", requestId, meta: { slug: project.slug, shareCode: project.share_code } });
  } catch {
    // ignore
  }

  for (const file of validation.normalized) {
    const r2Key = `edu/v1/${project.slug}/${file.path}`;
    let head: Awaited<ReturnType<typeof headObject>>;
    try {
      head = await headObject(r2Key);
    } catch (error) {
      const message = error instanceof Error ? error.message : "r2_head_failed";
      await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "FAILED", publishStateReason: "R2_HEAD_FAILED", lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
      return jsonErrorWithRequestId("R2_HEAD_FAILED", message, requestId, 502, undefined, withNoStoreHeaders());
    }

    if (!head.exists) {
      await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "FAILED", publishStateReason: "FILE_MISSING", lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
      const slugPrefix = `edu/v1/${project.slug}/`;
      const r2Target = getR2TargetMeta();
      let prefixListingCount = 0;
      let prefixSample: string[] = [];
      try {
        const listing = await listObjectKeysV2({ prefix: slugPrefix, maxKeys: FILE_MISSING_LIST_MAX_KEYS });
        const relativeKeys = listing.keys.map((key) => key.slice(slugPrefix.length)).filter(Boolean);
        prefixListingCount = relativeKeys.length;
        prefixSample = relativeKeys.slice(0, FILE_MISSING_SAMPLE_MAX);
      } catch {
        // best effort
      }
      return jsonErrorWithRequestId(
        "FILE_MISSING",
        `File missing: ${file.path}`,
        requestId,
        400,
        fileMissingExtra({ path: file.path, actualPath: file.path, slug: project.slug, slugPrefix, checkedKey: r2Key, bucketName: r2Target.bucketName, r2TargetKind: r2Target.r2TargetKind, endpoint: r2Target.endpoint, accountId: r2Target.accountId, hasObjectsUnderPrefix: prefixListingCount > 0, prefixListingCount, prefixSample }),
        withNoStoreHeaders(),
      );
    }

    if (head.contentLength && head.contentLength !== file.sizeBytes) {
      await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "FAILED", publishStateReason: "FILE_SIZE_MISMATCH", lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
      return jsonErrorWithRequestId("FILE_SIZE_MISMATCH", `File size mismatch: ${file.path}`, requestId, 400, undefined, withNoStoreHeaders());
    }
  }

  const { error: publishingError } = await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "PUBLISHING", publishStateReason: null, lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
  if (publishingError) return jsonErrorWithRequestId("PUBLISH_STATE_FAILED", publishingError.message, requestId, 500, undefined, withNoStoreHeaders());

  try {
    await insertPublishEvent({ supabase, projectId: project.id, state: "PUBLISHING", requestId, meta: { slug: project.slug, shareCode: project.share_code } });
  } catch {
    // ignore
  }

  const links = buildPublishLinks(await getRequestOrigin(request.headers), project.slug);
  const publishPayload = buildAtomicPublishPayload({
    shareCode: project.share_code,
    lessonId: project.lesson_id,
    authorName: project.author_name,
    title: project.title,
    inSlug: project.slug,
    anonId: project.anon_id,
    boardId,
    expiresAt: project.expires_at ?? getEduProjectExpiresAt(),
    files: validation.normalized.map((file) => ({ path: file.path, contentType: file.contentType, sizeBytes: file.sizeBytes })),
    previewUrl: project.preview_url ?? links.previewUrl,
    galleryPreviewUrl: buildGalleryPreviewUrl(project.slug),
    publicUrl: project.public_url ?? links.publicUrl,
    classroomUrl: project.classroom_url ?? links.classroomUrl,
    requestId,
  });

  if (!resolveInSlug(publishPayload)) {
    return jsonErrorWithRequestId("INVALID_SLUG", "in_slug is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const { error: publishError } = await supabase.rpc(EDU_ATOMIC_PUBLISH_RPC_V2, publishPayload);
  if (publishError) {
    const message = publishError.message;
    const pgCode = typeof publishError.code === "string" ? publishError.code : null;
    const messageLower = message.toLowerCase();
    const isDbFunctionBug = messageLower.includes("ambiguous") || messageLower.includes("column reference") || message.includes("42P13") || messageLower.includes("cannot change name of input parameter");
    const failureCode = isDbFunctionBug ? "DB_FUNCTION_BUG" : "PUBLISH_FAILED";

    await supabase.from("edu_projects").update(toSnakeKeys({ publishState: "FAILED", publishStateReason: failureCode, lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);

    if (isDbFunctionBug) {
      const extra = buildDbFunctionBugExtra({ rpcName: EDU_ATOMIC_PUBLISH_RPC_V2, payload: publishPayload, supabaseRef, pgCode });
      console.error("[publish.retry] DB_FUNCTION_BUG", { requestId, ...extra });
      return jsonErrorWithRequestId("DB_FUNCTION_BUG", message, requestId, 500, extra, withNoStoreHeaders());
    }
    return jsonErrorWithRequestId("PUBLISH_FAILED", message, requestId, 500, undefined, withNoStoreHeaders());
  }

  const { data: updatedProject, error: updatedError } = await supabase
    .from("edu_projects")
    .select("id,slug,publish_state,publish_state_reason,last_validated_at,last_published_at,public_url,classroom_url,last_request_id")
    .eq("id", project.id)
    .returns<PublishProjectRow>()
    .maybeSingle();

  if (updatedError || !updatedProject) {
    return jsonErrorWithRequestId("PROJECT_LOOKUP_FAILED", updatedError?.message ?? "project_lookup_failed", requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ project: buildPublishResponse(updatedProject) }, requestId, withNoStoreHeaders());
}
