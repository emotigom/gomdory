import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getEduProjectExpiresAt } from "@/lib/edu/expiration";
import { fileMissingExtra } from "@/lib/edu/publish/fileMissingDiagnostics";
import { buildAtomicPublishPayload, buildDbFunctionBugExtra, EDU_ATOMIC_PUBLISH_RPC_V2, resolveInSlug } from "@/lib/edu/publish/publishRpc";
import { validateEduPublishFiles } from "@/lib/edu/validateFiles";
import { getRequestOrigin } from "@/lib/http/requestHost";
import { getR2TargetMeta, headObject, listObjectKeysV2 } from "@/lib/r2/client";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { toSnakeKeys } from "@/lib/standards/fields";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RetryBody = {
  shareCode?: string;
  share_code?: string;
  anonId?: string | null;
  anon_id?: string | null;
  lessonId?: number | string | null;
  lesson_id?: number | string | null;
  baseSlug?: string | null;
  base_slug?: string | null;
};

type EduProjectUpdatePayload = Database["public"]["Tables"]["edu_projects"]["Update"];

const RETRY_WINDOW_MS = 5000;
const FILE_MISSING_LIST_MAX_KEYS = 200;
const FILE_MISSING_SAMPLE_MAX = 20;
const retryLimiter = new Map<string, number>();

type PublishEventInsert = Database["public"]["Tables"]["publish_events"]["Insert"];

function buildPublishEventInsert({ projectId, state, requestId, reasonCode, meta }: { projectId: string; state: string; requestId: string; reasonCode?: string | null; meta?: Record<string, unknown> }): PublishEventInsert {
  return { project_id: projectId, state, reason_code: reasonCode ?? null, request_id: requestId, meta: meta ?? {} };
}

function buildPublishLinks(origin: string, slug: string) {
  const publicUrl = new URL(`/edu/view/${slug}/`, origin);
  const previewUrl = new URL(`/edu/view/${slug}/`, origin);
  previewUrl.searchParams.set("preview", "1");
  const classroomUrl = new URL(`/edu/view/${slug}/`, origin);
  classroomUrl.searchParams.set("classroom", "1");
  return { publicUrl: publicUrl.toString(), previewUrl: previewUrl.toString(), classroomUrl: classroomUrl.toString() };
}

function buildGalleryPreviewUrl(slug: string) {
  const publicOrigin = readEduviewOrigin();
  return `${publicOrigin.replace(/\/$/, "")}/v1/${slug}/thumb.png`;
}

function parseVersionFromSlug(slug: string) {
  const match = slug.match(/-v(\d+)$/);
  if (!match) return 1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 1;
}

function checkRetryLimit(key: string, now: number): { ok: true } | { ok: false; retryAfterMs: number } {
  const last = retryLimiter.get(key);
  if (last && now - last < RETRY_WINDOW_MS) return { ok: false, retryAfterMs: RETRY_WINDOW_MS - (now - last) };
  retryLimiter.set(key, now);
  return { ok: true };
}

export async function handleTeacherPublishRetryRoute({ request, requestId, payload }: { request: NextRequest; requestId: string; payload: unknown } ): Promise<Response> {
  const supabaseUrl = readEnvString("SUPABASE_URL") ?? "";
  const supabaseRef = (() => {
    try {
      return new URL(supabaseUrl).host.split(".")[0] || "unknown";
    } catch {
      return "unknown";
    }
  })();

  const body = (payload ?? null) as RetryBody | null;
  const shareCode = normalizeShareCode(body?.shareCode ?? body?.share_code ?? "");
  const anonIdInput = body?.anonId ?? body?.anon_id;
  const anonIdRaw = typeof anonIdInput === "string" ? anonIdInput.trim() : "";
  const anonId = anonIdRaw ? anonIdRaw : null;
  const lessonIdInput = body?.lessonId ?? body?.lesson_id;
  const lessonIdRaw = typeof lessonIdInput === "string" ? Number(lessonIdInput) : lessonIdInput;
  const lessonId = Number.isFinite(lessonIdRaw) ? Number(lessonIdRaw) : null;
  const baseSlugInput = body?.baseSlug ?? body?.base_slug;
  const baseSlug = typeof baseSlugInput === "string" ? baseSlugInput.trim() : "";

  if (!isLikelyShareCode(shareCode) || !anonId || !lessonId) {
    return jsonErrorWithRequestId("INVALID_PARAMS", "shareCode, anonId, lessonId are required", requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const rateCheck = checkRetryLimit(`${shareCode}:${anonId}:${lessonId}`, Date.now());
  if (!rateCheck.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil(rateCheck.retryAfterMs / 1000));
    return jsonErrorWithRequestId("RATE_LIMITED", "잠시 후 다시 시도해 주세요.", requestId, 429, { retryAfterSeconds }, withNoStoreHeaders({ headers: { "Retry-After": String(retryAfterSeconds) } }));
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: joinCodeRow, error: joinCodeError } = await supabaseAdmin.from("edu_join_codes").select("board_id").eq("code", shareCode).maybeSingle();
  if (joinCodeError || !joinCodeRow?.board_id) {
    return jsonErrorWithRequestId("CLASSROOM_NOT_FOUND", "반 코드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc("board_role", { bid: joinCodeRow.board_id });
  const boardRole = normalizeBoardRole(role);
  if (roleError || !boardRole) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }
  if (boardRole === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  let projectQuery = supabaseAdmin
    .from("edu_projects")
    .select("id, slug, share_code, anon_id, lesson_id, author_name, title, board_id, expires_at, preview_url, public_url, classroom_url, publish_state, publish_state_reason")
    .eq("share_code", shareCode)
    .eq("lesson_id", lessonId);
  projectQuery = anonId ? projectQuery.eq("anon_id", anonId) : projectQuery.is("anon_id", null);
  if (baseSlug) projectQuery = projectQuery.like("slug", `${baseSlug}%`);

  const { data: project, error: projectError } = await projectQuery.order("updated_at", { ascending: false }).maybeSingle();
  if (projectError || !project) {
    return jsonErrorWithRequestId("PROJECT_NOT_FOUND", "재시도할 프로젝트를 찾지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  const { data: fileRows, error: fileError } = await supabaseAdmin.from("edu_project_files").select("path, content_type, size_bytes").eq("project_id", project.id).order("path", { ascending: true });
  if (fileError || !fileRows || fileRows.length === 0) {
    return jsonErrorWithRequestId("FILES_NOT_FOUND", "게시 파일을 찾지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  const validation = validateEduPublishFiles(fileRows.map((file) => ({ path: file.path, contentType: file.content_type, sizeBytes: file.size_bytes })));
  if (!validation.ok) return jsonErrorWithRequestId(validation.code, validation.message, requestId, 400, undefined, withNoStoreHeaders());

  const links = buildPublishLinks(await getRequestOrigin(request.headers), project.slug);

  const failPublish = async (code: string, message: string, status: number, meta?: Record<string, unknown>) => {
    await supabaseAdmin.from("edu_projects").update(toSnakeKeys({ publishState: "FAILED", publishStateReason: code, lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
    try {
      await supabaseAdmin.from("publish_events").insert(buildPublishEventInsert({ projectId: project.id, state: "FAILED", reasonCode: code, requestId, meta }));
    } catch {}
    return jsonErrorWithRequestId(code, message, requestId, status, undefined, withNoStoreHeaders());
  };

  try {
    await supabaseAdmin.from("edu_projects").update(toSnakeKeys({ publishState: "VALIDATING", publishStateReason: null, lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
    await supabaseAdmin.from("publish_events").insert(buildPublishEventInsert({ projectId: project.id, state: "VALIDATING", requestId, meta: { slug: project.slug, shareCode } }));
  } catch (error) {
    return failPublish("PUBLISH_EVENT_FAILED", error instanceof Error ? error.message : "publish_event_failed", 500, { stage: "validating" });
  }

  for (const file of validation.normalized) {
    const r2Key = `edu/v1/${project.slug}/${file.path}`;
    let head: Awaited<ReturnType<typeof headObject>>;
    try {
      head = await headObject(r2Key);
    } catch (error) {
      return failPublish("R2_HEAD_FAILED", error instanceof Error ? error.message : "r2_head_failed", 502, { path: file.path });
    }

    if (!head.exists) {
      const slugPrefix = `edu/v1/${project.slug}/`;
      const r2Target = getR2TargetMeta();
      let prefixListingCount = 0;
      let prefixSample: string[] = [];
      try {
        const listing = await listObjectKeysV2({ prefix: slugPrefix, maxKeys: FILE_MISSING_LIST_MAX_KEYS });
        const relativeKeys = listing.keys.map((key) => key.slice(slugPrefix.length)).filter(Boolean);
        prefixListingCount = relativeKeys.length;
        prefixSample = relativeKeys.slice(0, FILE_MISSING_SAMPLE_MAX);
      } catch {}
      return failPublish("FILE_MISSING", `File missing: ${file.path}`, 400, fileMissingExtra({ path: file.path, actualPath: file.path, slug: project.slug, slugPrefix, checkedKey: r2Key, bucketName: r2Target.bucketName, r2TargetKind: r2Target.r2TargetKind, endpoint: r2Target.endpoint, accountId: r2Target.accountId, hasObjectsUnderPrefix: prefixListingCount > 0, prefixListingCount, prefixSample }));
    }

    if (head.contentLength && head.contentLength !== file.sizeBytes) {
      return failPublish("FILE_SIZE_MISMATCH", `File size mismatch: ${file.path}`, 400, { path: file.path });
    }
  }

  const { error: publishingError } = await supabaseAdmin.from("edu_projects").update(toSnakeKeys({ publishState: "PUBLISHING", publishStateReason: null, lastRequestId: requestId }) as EduProjectUpdatePayload).eq("id", project.id);
  if (publishingError) return failPublish("PUBLISH_STATE_FAILED", publishingError.message, 500, { stage: "publishing" });

  try {
    await supabaseAdmin.from("publish_events").insert(buildPublishEventInsert({ projectId: project.id, state: "PUBLISHING", requestId, meta: { slug: project.slug, shareCode } }));
  } catch (error) {
    return failPublish("PUBLISH_EVENT_FAILED", error instanceof Error ? error.message : "publish_event_failed", 500, { stage: "publishing" });
  }

  const publishPayload = buildAtomicPublishPayload({
    shareCode,
    lessonId,
    authorName: project.author_name,
    title: project.title,
    inSlug: project.slug,
    anonId: project.anon_id,
    boardId: project.board_id,
    expiresAt: project.expires_at ?? getEduProjectExpiresAt(),
    files: validation.normalized.map((file) => ({ path: file.path, contentType: file.contentType, sizeBytes: file.sizeBytes })),
    previewUrl: project.preview_url ?? links.previewUrl,
    galleryPreviewUrl: buildGalleryPreviewUrl(project.slug),
    publicUrl: project.public_url ?? links.publicUrl,
    classroomUrl: project.classroom_url ?? links.classroomUrl,
    requestId,
  });

  if (!resolveInSlug(publishPayload)) return jsonErrorWithRequestId("INVALID_SLUG", "in_slug is required", requestId, 400, undefined, withNoStoreHeaders());

  const { data: publishedProjectId, error: publishError } = await supabaseAdmin.rpc(EDU_ATOMIC_PUBLISH_RPC_V2, publishPayload);
  if (publishError || !publishedProjectId) {
    const message = publishError?.message ?? "publish_failed";
    const pgCode = typeof publishError?.code === "string" ? publishError.code : null;
    const messageLower = message.toLowerCase();
    const isDbFunctionBug = messageLower.includes("ambiguous") || messageLower.includes("column reference") || message.includes("42P13") || messageLower.includes("cannot change name of input parameter");
    if (isDbFunctionBug) {
      const extra = buildDbFunctionBugExtra({ rpcName: EDU_ATOMIC_PUBLISH_RPC_V2, payload: publishPayload, supabaseRef, pgCode });
      console.error("[edu.teacher.publish.retry] DB_FUNCTION_BUG", { requestId, ...extra });
      return failPublish("DB_FUNCTION_BUG", message, 500, extra);
    }
    return failPublish("PUBLISH_FAILED", message, 500, { stage: "atomic_publish" });
  }

  return jsonOkWithRequestId({ publish: { slug: project.slug, version: parseVersionFromSlug(project.slug), previewUrl: project.preview_url ?? links.previewUrl, publicUrl: project.public_url ?? links.publicUrl, classroomUrl: project.classroom_url ?? links.classroomUrl, state: "PUBLISHED" } }, requestId, withNoStoreHeaders());
}
