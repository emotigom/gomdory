import { NextRequest, NextResponse } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { getEduProjectExpiresAt, getEduProjectTtlDays } from "@/lib/edu/expiration";
import { getLessonIdFromNumber } from "@/lib/edu/lesson/lessonLock";
import { buildEduPublishObjectKey, buildEduPublishPrefix } from "@/lib/edu/publish/objectKey";
import {
  classifyPublishAttemptCompatibility,
  type PublishAttemptCompatibility,
} from "@/lib/edu/publish/attemptCompatibility";
import {
  decideEduPublishCapabilityPolicy,
  type EduPublishCapabilityClassification,
  type EduPublishCapabilityPolicyDecision,
} from "@/lib/edu/publish/commitCapabilityPolicy";
import { verifyEduPublishCommitCapability } from "@/lib/edu/publish/commitCapability";
import {
  classifyPublishPrepareManifestEvidence,
  type PublishPrepareManifestEvidenceCompatibility,
} from "@/lib/edu/publish/prepareManifestEvidence";
import {
  validateEduPublishFiles,
  type EduPublishFileMetaInput,
  type EduPublishFileMetaNormalized,
} from "@/lib/edu/validateFiles";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { getRequestOrigin } from "@/lib/http/requestHost";
import { getR2TargetMeta, headObject, listObjectKeysV2 } from "@/lib/r2/client";
import { resolvePublishFilesForCommit, type PublishFileDebugListing } from "@/lib/edu/publish/commitFileResolution";
import { fileMissingExtra } from "@/lib/edu/publish/fileMissingDiagnostics";
import {
  buildDbFunctionBugExtra,
  EDU_ATOMIC_PUBLISH_RPC_V2,
  resolveInSlug,
} from "@/lib/edu/publish/publishRpc";
import { DAILY_PUBLISH_LIMIT, buildPublishQuotaIdentity, getKstDayRange } from "@/lib/edu/publish/quota";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { buildEduBaseSlug, buildEduVersionedSlug } from "@/lib/share/slug";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { loadEduPublishCapabilityKeyRing } from "@/lib/server/edu/publish/commitCapabilityRuntime";
import { loadEduPublishCapabilityPolicyMode } from "@/lib/server/edu/publish/commitCapabilityPolicyRuntime";
import {
  loadEduPublishCommitAttemptMode,
  type EduPublishCommitAttemptModeRuntimeResult,
} from "@/lib/server/edu/publish/commitAttemptRolloutRuntime";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";
import { buildPracticeSubmissionTitle } from "@/lib/edu/practiceSubmission";

const BOARD_COOKIE_NAME = "edu_board_id";

export type CommitBody = {
  slug?: string;
  shareCode?: string;
  authorName?: string;
  title?: string;
  files?: EduPublishFileMetaInput[];
  publishAttemptId?: unknown;
  manifestSchemaVersion?: unknown;
  declaredManifestDigest?: unknown;
  declaredManifest?: unknown;
  publishCapability?: unknown;
  turnstileToken?: string;
  anonId?: string | null;
  boardId?: string | null;
  assignmentId?: string | null;
  lessonId?: number | string | null;
  request_id?: string;
};

type AssignmentSubmissionResult =
  | { ok: true; postedToBoard: boolean }
  | { ok: false; error: string };

type AssignmentRow = Database["public"]["Tables"]["edu_assignments"]["Row"] & Record<string, unknown>;
type BoardRow = Database["public"]["Tables"]["boards"]["Row"] & Record<string, unknown>;
type WallRow = Database["public"]["Tables"]["walls"]["Row"] & Record<string, unknown>;

type PublishCommitManifestEvidenceClassification =
  | "legacy"
  | "declared_v1"
  | "partial"
  | "invalid"
  | "unsupported_schema"
  | "digest_mismatch"
  | "metadata_mismatch"
  | "evaluation_failed";

type PublishCommitManifestEvidenceOutcome = "published" | "reused" | "degraded";

type PublishCommitAttemptIdentityClassification =
  | "legacy"
  | "attempt_v1"
  | "partial"
  | "invalid"
  | "unsupported_schema"
  | "evidence_unconfirmed"
  | "evaluation_failed";

type PublishCommitCapabilityClassification = EduPublishCapabilityClassification;

function matchesCommitFileMetadata(
  manifestFiles: ReadonlyArray<{ path: string; sizeBytes: number; contentType: string }>,
  validatedFiles: EduPublishFileMetaNormalized[],
): boolean {
  if (manifestFiles.length !== validatedFiles.length) return false;

  const validatedByPath = new Map(validatedFiles.map((file) => [file.path, file]));
  return manifestFiles.every((manifestFile) => {
    const validatedFile = validatedByPath.get(manifestFile.path);
    return Boolean(
      validatedFile &&
        validatedFile.sizeBytes === manifestFile.sizeBytes &&
        validatedFile.contentType === manifestFile.contentType,
    );
  });
}

function toCommitManifestEvidenceClassification(
  result: PublishPrepareManifestEvidenceCompatibility,
  validatedFiles: EduPublishFileMetaNormalized[],
): PublishCommitManifestEvidenceClassification {
  if (result.mode !== "declared_v1") return result.mode;
  return matchesCommitFileMetadata(result.evidence.declaredManifest.files, validatedFiles)
    ? "declared_v1"
    : "metadata_mismatch";
}

function toCommitAttemptIdentityClassification(
  compatibility: PublishAttemptCompatibility,
  manifestClassification: PublishCommitManifestEvidenceClassification,
): PublishCommitAttemptIdentityClassification {
  switch (compatibility.mode) {
    case "legacy":
      return "legacy";
    case "attempt_v1":
      return manifestClassification === "declared_v1" ? "attempt_v1" : "evidence_unconfirmed";
    case "partial":
      return "partial";
    case "invalid":
      return "invalid";
    case "unsupported_schema":
      return "unsupported_schema";
    default:
      return "evaluation_failed";
  }
}


function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseVersionFromRequestedSlug(slug: string, shareCode: string, lessonId: number): number | null {
  const match = new RegExp(`^${escapeRegExp(shareCode)}-[a-z0-9]{6}-p${lessonId}(?:-v(\d+))?$`).exec(slug);
  if (!match) return null;
  if (!match[1]) return 1;
  const version = Number(match[1]);
  if (!Number.isInteger(version) || version < 2 || version > 200) return null;
  return version;
}

type PublishLinks = {
  previewUrl: string;
  publicUrl: string;
  classroomUrl: string;
};

type ExistingPublishProject = Pick<
  Database["public"]["Tables"]["edu_projects"]["Row"],
  "id" | "slug" | "preview_url" | "public_url" | "classroom_url" | "publish_state" | "share_code" | "author_name" | "lesson_id"
>;

function buildPublishLinks(origin: string, slug: string): PublishLinks {
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

async function findExistingPublishedProject({
  supabase,
  slug,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  slug: string;
}): Promise<ExistingPublishProject | null> {
  const { data: slugMatch, error: slugError } = (await supabase
    .from("edu_projects")
    .select("id, slug, preview_url, public_url, classroom_url, publish_state, share_code, author_name, lesson_id")
    .eq("slug", slug)
    .maybeSingle()) as { data: ExistingPublishProject | null; error: { message: string } | null };

  if (slugError) {
    throw new Error(slugError.message);
  }

  if (slugMatch) {
    return slugMatch;
  }
  return null;
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
  if (error) {
    throw new Error(error.message);
  }
}

async function postSubmissionCard({
  supabase,
  boardId,
  assignmentTitle,
  studentName,
  viewUrl,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  boardId: string;
  assignmentTitle: string;
  studentName: string;
  viewUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: board, error: boardError } = (await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .maybeSingle()) as { data: BoardRow | null; error: { message: string } | null };

  if (boardError || !board?.owner_id) {
    return { ok: false, error: boardError?.message ?? "board_not_found" };
  }

  const { data: walls, error: wallsError } = (await supabase
    .from("walls")
    .select("id, title, position")
    .eq("board_id", boardId)
    .order("position", { ascending: true })) as { data: WallRow[] | null; error: { message: string } | null };

  if (wallsError) {
    return { ok: false, error: wallsError.message };
  }

  let targetWallId = (walls ?? []).find((wall) => wall.title.includes("제출"))?.id;
  if (!targetWallId) {
    targetWallId = (walls ?? []).find((wall) => wall.title.toLowerCase().includes("submit"))?.id;
  }

  if (!targetWallId) {
    const nextPosition = (walls ?? []).length
      ? Math.max(...(walls ?? []).map((wall) => wall.position)) + 1
      : 1;
    const { data: createdWall, error: createError } = await supabase
      .from("walls")
      .insert({
        board_id: boardId,
        owner_id: board.owner_id,
        title: "제출함",
        position: nextPosition,
      })
      .select("id")
      .single();

    if (createError || !createdWall) {
      return { ok: false, error: createError?.message ?? "wall_create_failed" };
    }

    targetWallId = createdWall.id;
  }

  const text = buildPracticeSubmissionTitle(studentName);
  const { error: cardError } = await supabase.from("cards").insert({
    wall_id: targetWallId,
    owner_id: board.owner_id,
    text,
    author_type: "student",
    author_name: studentName,
    external_attachments: [
      {
        kind: "practice",
        url: viewUrl,
        filename: assignmentTitle,
      },
    ],
  });

  if (cardError) {
    return { ok: false, error: cardError.message };
  }

  return { ok: true };
}

async function recordAssignmentSubmission({
  supabase,
  assignmentId,
  shareCode,
  anonId,
  studentName,
  slug,
  lessonId,
  viewUrl,
  requestId,
  route,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  assignmentId: string;
  shareCode: string;
  anonId: string | null;
  studentName: string;
  slug: string;
  lessonId: number | null;
  viewUrl: string;
  requestId: string;
  route: string;
}): Promise<AssignmentSubmissionResult> {
  const { data: assignmentRow, error: assignmentError } = (await supabase
    .from("edu_assignments")
    .select("id, board_id, share_code, title")
    .eq("id", assignmentId)
    .maybeSingle()) as { data: AssignmentRow | null; error: { message: string } | null };

  if (assignmentError || !assignmentRow) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "api_error",
        requestId,
        route,
        status: 404,
        meta: {
          shareCode,
          slug,
          lessonId,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return { ok: false, error: "assignment_not_found" };
  }

  const assignment = assignmentRow as AssignmentRow;

  if (assignment.share_code !== shareCode) {
    return { ok: false, error: "assignment_share_code_mismatch" };
  }

  const { error: submissionError } = await supabase.from("edu_submissions").insert({
    assignment_id: assignmentId,
    anon_id: anonId,
    student_name: studentName,
    slug,
  });

  if (submissionError) {
    if (submissionError.code === "23505" || submissionError.message.includes("duplicate key")) {
      return { ok: true, postedToBoard: false };
    }
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "api_error",
        requestId,
        route,
        status: 200,
        meta: {
          shareCode,
          slug,
          lessonId,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return { ok: false, error: submissionError.message };
  }

  const boardId = assignment.board_id;
  if (!boardId) {
    return { ok: true, postedToBoard: false };
  }

  const cardResult = await postSubmissionCard({
    supabase,
    boardId,
    assignmentTitle: assignment.title,
    studentName,
    viewUrl,
  });

  if (!cardResult.ok) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "api_error",
        requestId,
        route,
        status: 200,
        meta: {
          shareCode,
          slug,
          lessonId,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return { ok: true, postedToBoard: false };
  }

  return { ok: true, postedToBoard: true };
}

function commitError<T extends Record<string, unknown>>(
  code: string,
  message: string,
  requestId: string,
  status: number,
  extra?: T,
  init?: ResponseInit,
) {
  return jsonErrorWithRequestId(code, message, requestId, status, { errorCode: code, message, ...(extra ?? {}) }, init);
}

const PUBLISH_RESTART_REQUIRED_MESSAGE = "이전 게시 시도가 실패했어요. 새 게시를 시작한 뒤 다시 시도해 주세요.";

function publishRestartRequired(requestId: string) {
  return commitError(
    "PUBLISH_RESTART_REQUIRED",
    PUBLISH_RESTART_REQUIRED_MESSAGE,
    requestId,
    409,
    undefined,
    withNoStoreHeaders(),
  );
}

const FILE_MISSING_LIST_MAX_KEYS = 200;
const FILE_MISSING_SAMPLE_MAX = 20;

export type PublishCommitDeps = {
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  verifyTurnstileTokenWithTelemetryFn?: typeof verifyTurnstileTokenWithTelemetry;
  listObjectKeysV2Fn?: typeof listObjectKeysV2;
  headObjectFn?: typeof headObject;
  getR2TargetMetaFn?: typeof getR2TargetMeta;
  checkRateLimitFn?: typeof checkRateLimit;
  getRateLimitSubjectFn?: typeof getRateLimitSubject;
  getRequestOriginFn?: typeof getRequestOrigin;
  recordOpsEventFn?: typeof recordOpsEvent;
  classifyPublishManifestEvidenceFn?: typeof classifyPublishPrepareManifestEvidence;
  classifyPublishAttemptCompatibilityFn?: typeof classifyPublishAttemptCompatibility;
  loadPublishCapabilityKeyRingFn?: typeof loadEduPublishCapabilityKeyRing;
  loadPublishCapabilityPolicyModeFn?: typeof loadEduPublishCapabilityPolicyMode;
  verifyPublishCapabilityFn?: typeof verifyEduPublishCommitCapability;
  loadCommitAttemptModeFn?: typeof loadEduPublishCommitAttemptMode;
  nowSecondsFn?: () => number;
};

export async function handleEduPublishCommit(request: NextRequest, deps: PublishCommitDeps = {}) {
  const createSupabaseAdminClientFn = deps.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const createSupabaseServerClientFn = deps.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const verifyTurnstileTokenWithTelemetryFn = deps.verifyTurnstileTokenWithTelemetryFn ?? verifyTurnstileTokenWithTelemetry;
  const listObjectKeysV2Fn = deps.listObjectKeysV2Fn ?? listObjectKeysV2;
  const headObjectFn = deps.headObjectFn ?? headObject;
  const getR2TargetMetaFn = deps.getR2TargetMetaFn ?? getR2TargetMeta;
  const checkRateLimitFn = deps.checkRateLimitFn ?? checkRateLimit;
  const getRateLimitSubjectFn = deps.getRateLimitSubjectFn ?? getRateLimitSubject;
  const getRequestOriginFn = deps.getRequestOriginFn ?? getRequestOrigin;
  const recordOpsEventFn = deps.recordOpsEventFn ?? recordOpsEvent;
  const classifyPublishManifestEvidenceFn =
    deps.classifyPublishManifestEvidenceFn ?? classifyPublishPrepareManifestEvidence;
  const classifyPublishAttemptCompatibilityFn =
    deps.classifyPublishAttemptCompatibilityFn ?? classifyPublishAttemptCompatibility;
  const loadPublishCapabilityKeyRingFn = deps.loadPublishCapabilityKeyRingFn ?? loadEduPublishCapabilityKeyRing;
  const loadPublishCapabilityPolicyModeFn =
    deps.loadPublishCapabilityPolicyModeFn ?? loadEduPublishCapabilityPolicyMode;
  const verifyPublishCapabilityFn = deps.verifyPublishCapabilityFn ?? verifyEduPublishCommitCapability;
  const loadCommitAttemptModeFn = deps.loadCommitAttemptModeFn ?? loadEduPublishCommitAttemptMode;
  const nowSecondsFn = deps.nowSecondsFn ?? (() => Math.floor(Date.now() / 1000));

  const payload = (await request.json().catch(() => null)) as CommitBody | null;
  const fallbackRequestId = getOrCreateRequestId(request);
  const requestId =
    typeof payload?.request_id === "string" && payload.request_id.trim() ? payload.request_id.trim() : fallbackRequestId;
  const supabaseUrl = readEnvString("SUPABASE_URL") ?? "";
  const supabaseRef = (() => {
    try {
      return new URL(supabaseUrl).host.split(".")[0] || "unknown";
    } catch {
      return "unknown";
    }
  })();

  if (!payload) {
    return commitError("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const shareCode = normalizeShareCode(payload.shareCode ?? "");
  if (!isLikelyShareCode(shareCode)) {
    return commitError("INVALID_SHARE_CODE", "shareCode is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const authorName = typeof payload.authorName === "string" ? payload.authorName.trim() : "";
  if (!authorName) {
    return commitError("INVALID_AUTHOR", "authorName is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return commitError("INVALID_TITLE", "title is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const lessonIdRaw = typeof payload.lessonId === "string" ? Number(payload.lessonId) : payload.lessonId;
  const lessonId = Number.isFinite(lessonIdRaw) ? Number(lessonIdRaw) : null;
  if (lessonId === null || lessonId < 0 || lessonId > 4) {
    return commitError("INVALID_LESSON_ID", "lessonId is required", requestId, 400, undefined, withNoStoreHeaders());
  }
  const dbLessonId = lessonId === 0 ? null : lessonId;

  const validation = validateEduPublishFiles(payload.files ?? []);
  if (!validation.ok) {
    return commitError(validation.code, validation.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken.trim() : "";
  if (!turnstileToken) {
    return commitError("TURNSTILE_REQUIRED", "turnstileToken is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const payloadAnonId = typeof payload.anonId === "string" ? payload.anonId.trim() : null;
  const cookieAnonId = request.cookies.get("edu_anon_id")?.value?.trim() ?? null;
  const anonId = payloadAnonId || cookieAnonId || null;
  const cookieBoardId = request.cookies.get(BOARD_COOKIE_NAME)?.value?.trim() ?? null;
  const assignmentId = typeof payload.assignmentId === "string" ? payload.assignmentId.trim() : "";
  const subject = await getRateLimitSubjectFn(request, anonId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;
  const baseSlug = buildEduBaseSlug({ shareCode, lessonId, anonId, requestId });
  const requestedSlug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const requestedVersion = requestedSlug ? parseVersionFromRequestedSlug(requestedSlug, shareCode, lessonId) : null;
  if (requestedSlug && requestedVersion === null) {
    return commitError("INVALID_SLUG", "slug is invalid or stale. please prepare again.", requestId, 400, { expectedPattern: `${shareCode}-xxxxxx-p${lessonId}[-vN]` }, withNoStoreHeaders());
  }
  const studentKey = requestedSlug || baseSlug;
  const supabase = createSupabaseAdminClientFn();
  const supabaseServer = createSupabaseServerClientFn();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  const quotaIdentity = buildPublishQuotaIdentity({
    userId: user?.id ?? null,
    shareCode,
    lessonId,
    authorName,
  });
  const kstDay = getKstDayRange();
  const logPublishFailure = ({
    status,
    slug,
    level = "warn",
  }: {
    status: number;
    slug?: string;
    level?: "warn" | "error";
  }) => {
    void recordOpsEvent(
      toSnakeKeys({
        level,
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status,
        meta: {
          shareCode,
          slug,
          lessonId,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
  };
  const logR2DatabaseBoundaryFailure = (status: number) => {
    void Promise.resolve(
      recordOpsEventFn(
        toSnakeKeys({
          level: "error",
          kind: "api_error",
          requestId,
          route: request.nextUrl.pathname,
          status,
          meta: {
            stage: "edu_publish",
            component: "r2_database_boundary",
            result: "failed",
            mappedReason: "database_write_failed_after_object_store",
            objectWriteCompleted: true,
            orphanCandidate: true,
          },
        }, { deep: true }) as Parameters<typeof recordOpsEvent>[0],
        { sampleRate: 1, hardLimitPerMinute: 120 },
      ),
    ).catch(() => undefined);
  };
  const logConcurrentProjectLookupFailure = (status: number) => {
    void Promise.resolve(
      recordOpsEventFn(
        toSnakeKeys({
          level: "error",
          kind: "api_error",
          requestId,
          route: request.nextUrl.pathname,
          status,
          meta: {
            stage: "edu_publish",
            component: "database",
            result: "failed",
            mappedReason: "concurrent_project_lookup_failed",
          },
        }, { deep: true }) as Parameters<typeof recordOpsEvent>[0],
        { sampleRate: 1, hardLimitPerMinute: 120 },
      ),
    ).catch(() => undefined);
  };
  const buildDbNotReadyResponse = (missing: string[] | null, detail?: string) => {
    if (detail) {
      console.error("[publish.commit] DB_NOT_READY", { requestId, shareCode, slug: baseSlug, lessonId });
    } else {
      console.error("[publish.commit] DB_NOT_READY", { requestId, shareCode, slug: baseSlug, lessonId });
    }
    const headers = withNoStoreHeaders({
      headers: {
        "x-request-id": requestId,
        "x-gom-request-id": requestId,
        "content-type": "application/json",
      },
    }).headers;
    return NextResponse.json(
      {
        ok: false,
        code: "DB_NOT_READY",
        message: "서버 게시 기능(DB)이 아직 준비되지 않았어요. 선생님께 알려주세요.",
        requestId,
        supabaseRef,
        missing: missing?.length ? missing : ["unknown"],
      },
      { status: 500, headers },
    );
  };

  try {
    const { data: readyData, error: readyErr } = await supabase.rpc("edu_check_publish_ready");
    if (readyErr || !readyData || readyData.ok !== true) {
      const missing = Array.isArray(readyData?.missing) ? readyData.missing : ["unknown"];
      return buildDbNotReadyResponse(missing, readyErr?.message ?? "ready_check_failed");
    }

    limitResult = await checkRateLimitFn(supabase as unknown as Parameters<typeof checkRateLimit>[0], {
      key: `edu:publish:commit:${shareCode || "na"}:${subject}`,
      windowSeconds: 60,
      limit: 6,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "rate_limit_check_failed";
    logPublishFailure({ status: 500, slug: baseSlug, level: "error" });

    return commitError("RATE_LIMIT_CHECK_FAILED", message, requestId, 500, undefined, withNoStoreHeaders());
  }

  if (limitResult && !limitResult.ok) {
    logPublishFailure({ status: 429, slug: baseSlug, level: "warn" });

    return commitError(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  const originHeader = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");
  const cfRay = request.headers.get("cf-ray");
  const verification = await verifyTurnstileTokenWithTelemetryFn(turnstileToken, {
    requestId,
    route: request.nextUrl.pathname,
    action: "edu_publish_commit",
    originHost: originHeader,
    refererHost: referer,
    ip,
    userAgent,
    cfRay,
    cookiePresent: Boolean(request.headers.get("cookie")),
  });
  if (!verification.ok) {
    logPublishFailure({ status: 400, slug: baseSlug, level: "warn" });

    return commitError(
      "TURNSTILE_FAILED",
      verification.userMessage ?? "Turnstile verification failed.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const files = validation.normalized;
  let manifestEvidenceClassification: PublishCommitManifestEvidenceClassification = "evaluation_failed";
  try {
    manifestEvidenceClassification = toCommitManifestEvidenceClassification(
      await classifyPublishManifestEvidenceFn(payload),
      files,
    );
  } catch {
    manifestEvidenceClassification = "evaluation_failed";
  }

  let attemptIdentityClassification: PublishCommitAttemptIdentityClassification = "evaluation_failed";
  try {
    const compatibility = classifyPublishAttemptCompatibilityFn({
      publishAttemptId: payload.publishAttemptId,
      declaredManifestDigest: payload.declaredManifestDigest,
      manifestSchemaVersion: payload.manifestSchemaVersion,
    });
    attemptIdentityClassification = toCommitAttemptIdentityClassification(
      compatibility,
      manifestEvidenceClassification,
    );
  } catch {
    attemptIdentityClassification = "evaluation_failed";
  }

  let capabilityClassification: PublishCommitCapabilityClassification = "evaluation_failed";
  if (payload.publishCapability === undefined || payload.publishCapability === null) {
    capabilityClassification = "missing";
  } else if (
    ["legacy", "partial", "invalid", "unsupported_schema", "evaluation_failed"].includes(
      attemptIdentityClassification,
    )
  ) {
    capabilityClassification = "attempt_unconfirmed";
  } else if (attemptIdentityClassification === "evidence_unconfirmed" || manifestEvidenceClassification !== "declared_v1") {
    capabilityClassification = "evidence_unconfirmed";
  } else {
    try {
      const keyRingResult = loadPublishCapabilityKeyRingFn();
      if (keyRingResult.mode !== "available") {
        capabilityClassification = "configuration_unavailable";
      } else {
        let nowSeconds: number | undefined;
        try {
          nowSeconds = nowSecondsFn();
        } catch {
          capabilityClassification = "evaluation_failed";
        }

        if (nowSeconds !== undefined) {
          try {
            const verification = await verifyPublishCapabilityFn({
              token: payload.publishCapability,
              keyRing: keyRingResult.keyRing,
              nowSeconds,
              expected: {
                publishAttemptId: payload.publishAttemptId as string,
                slug: requestedSlug,
                declaredManifestDigest: payload.declaredManifestDigest as string,
                manifestSchemaVersion: payload.manifestSchemaVersion as 1,
              },
            });
            const knownClassifications: PublishCommitCapabilityClassification[] = [
              "valid_v2",
              "malformed",
              "unsupported_version",
              "unknown_kid",
              "invalid_signature",
              "expired",
              "not_yet_valid",
              "invalid_lifetime",
              "invalid_claim",
              "claim_mismatch",
              "configuration_unavailable",
              "evaluation_failed",
            ];
            capabilityClassification = knownClassifications.includes(verification.mode)
              ? verification.mode
              : "evaluation_failed";
          } catch {
            capabilityClassification = "evaluation_failed";
          }
        }
      }
    } catch {
      capabilityClassification = "evaluation_failed";
    }
  }

  let policyRuntime: ReturnType<typeof loadEduPublishCapabilityPolicyMode> = {
    mode: "observe" as const,
    source: "evaluation_failed_fallback" as const,
  };
  try {
    policyRuntime = loadPublishCapabilityPolicyModeFn();
  } catch {
    policyRuntime = {
      mode: "observe",
      source: "evaluation_failed_fallback",
    };
  }

  const capabilityPolicyDecision: EduPublishCapabilityPolicyDecision = decideEduPublishCapabilityPolicy({
    mode: policyRuntime.mode,
    classification: capabilityClassification,
  });

  let commitAttemptMode: EduPublishCommitAttemptModeRuntimeResult = {
    mode: "legacy",
    source: "evaluation_failed_fallback",
  };

  try {
    commitAttemptMode = loadCommitAttemptModeFn();
  } catch {
    commitAttemptMode = {
      mode: "legacy",
      source: "evaluation_failed_fallback",
    };
  }

  if (capabilityPolicyDecision.action === "reject") {
    void Promise.resolve()
      .then(() =>
        recordOpsEventFn(
          {
            level: "warn",
            kind: "api_error",
            requestId,
            route: request.nextUrl.pathname,
            status: capabilityPolicyDecision.status,
            meta: {
              stage: "edu_publish_commit",
              component: "commit_capability_policy",
              result: "rejected",
              mode: policyRuntime.mode,
              classification: capabilityClassification,
              code: capabilityPolicyDecision.code,
            },
          },
          { sampleRate: 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);

    return jsonErrorWithRequestId(
      capabilityPolicyDecision.code,
      capabilityPolicyDecision.message,
      requestId,
      capabilityPolicyDecision.status,
      capabilityPolicyDecision.retryAfterSeconds
        ? {
            retryAfterSeconds: capabilityPolicyDecision.retryAfterSeconds,
          }
        : undefined,
      withNoStoreHeaders({
        headers: capabilityPolicyDecision.retryAfterSeconds
          ? {
              "Retry-After": String(capabilityPolicyDecision.retryAfterSeconds),
            }
          : undefined,
      }),
    );
  }

  if (commitAttemptMode.mode === "secured_v1") {
    const securedCapabilityClassification: PublishCommitCapabilityClassification =
      attemptIdentityClassification !== "attempt_v1"
        ? "attempt_unconfirmed"
        : manifestEvidenceClassification !== "declared_v1"
          ? "evidence_unconfirmed"
          : capabilityClassification;
    const securedCapabilityPolicyDecision = decideEduPublishCapabilityPolicy({
      mode: "enforce_present",
      classification: securedCapabilityClassification,
    });
    const recordSecuredBlockEvent = (
      mappedReason: "capability_rejected" | "lifecycle_incomplete",
      status: number,
    ) => {
      void Promise.resolve()
        .then(() =>
          recordOpsEventFn(
            {
              level: "warn",
              kind: "api_error",
              requestId,
              route: request.nextUrl.pathname,
              status,
              meta: {
                stage: "edu_publish_commit",
                component: "commit_attempt_rollout",
                result: "blocked",
                mode: "secured_v1",
                mappedReason,
                classification: securedCapabilityClassification,
              },
            },
            { sampleRate: 1, hardLimitPerMinute: 120 },
          ),
        )
        .catch(() => undefined);
    };

    if (securedCapabilityClassification === "missing") {
      recordSecuredBlockEvent("capability_rejected", 401);
      return jsonErrorWithRequestId(
        "PUBLISH_CAPABILITY_INVALID",
        "게시 권한 증명이 유효하지 않습니다. 다시 게시를 시작해 주세요.",
        requestId,
        401,
        undefined,
        withNoStoreHeaders(),
      );
    }

    if (securedCapabilityClassification !== "valid_v2") {
      if (securedCapabilityPolicyDecision.action === "reject") {
        recordSecuredBlockEvent("capability_rejected", securedCapabilityPolicyDecision.status);
        return jsonErrorWithRequestId(
          securedCapabilityPolicyDecision.code,
          securedCapabilityPolicyDecision.message,
          requestId,
          securedCapabilityPolicyDecision.status,
          securedCapabilityPolicyDecision.retryAfterSeconds
            ? { retryAfterSeconds: securedCapabilityPolicyDecision.retryAfterSeconds }
            : undefined,
          withNoStoreHeaders({
            headers: securedCapabilityPolicyDecision.retryAfterSeconds
              ? { "Retry-After": String(securedCapabilityPolicyDecision.retryAfterSeconds) }
              : undefined,
          }),
        );
      }

      recordSecuredBlockEvent("capability_rejected", 503);
      return jsonErrorWithRequestId(
        "PUBLISH_CAPABILITY_UNAVAILABLE",
        "서버 게시 기능이 잠시 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
        requestId,
        503,
        { retryAfterSeconds: 30 },
        withNoStoreHeaders({ headers: { "Retry-After": "30" } }),
      );
    }

    recordSecuredBlockEvent("lifecycle_incomplete", 503);
    return jsonErrorWithRequestId(
      "PUBLISH_COMMIT_LIFECYCLE_UNAVAILABLE",
      "보안 게시 완료 기능이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
      requestId,
      503,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const recordManifestEvidenceObservation = (outcome: PublishCommitManifestEvidenceOutcome) => {
    void Promise.resolve()
      .then(() =>
        recordOpsEventFn(
          {
            level: "info",
            kind: "api_access",
            requestId,
            route: request.nextUrl.pathname,
            status: 200,
            meta: {
              stage: "edu_publish_commit",
              component: "manifest_evidence",
              result: "observed",
              classification: manifestEvidenceClassification,
              outcome,
            },
          },
          { sampleRate: manifestEvidenceClassification === "legacy" ? 10 : 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);
  };

  const recordAttemptIdentityObservation = (outcome: PublishCommitManifestEvidenceOutcome) => {
    void Promise.resolve()
      .then(() =>
        recordOpsEventFn(
          {
            level: "info",
            kind: "api_access",
            requestId,
            route: request.nextUrl.pathname,
            status: 200,
            meta: {
              stage: "edu_publish_commit",
              component: "attempt_identity",
              result: "observed",
              classification: attemptIdentityClassification,
              outcome,
            },
          },
          { sampleRate: attemptIdentityClassification === "legacy" ? 10 : 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);
  };

  const recordCapabilityObservation = (outcome: PublishCommitManifestEvidenceOutcome) => {
    void Promise.resolve()
      .then(() =>
        recordOpsEventFn(
          {
            level: "info",
            kind: "api_access",
            requestId,
            route: request.nextUrl.pathname,
            status: 200,
            meta: {
              stage: "edu_publish_commit",
              component: "commit_capability_verification",
              result: "observed",
              classification: capabilityClassification,
              outcome,
            },
          },
          { sampleRate: capabilityClassification === "missing" ? 10 : 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);
  };

  const { count, error: countError } = await supabase
    .from("edu_projects")
    .select("id", { count: "exact", head: true })
    .eq("publish_state", "PUBLISHED")
    .eq("publish_quota_key", quotaIdentity.quotaKey)
    .gte("last_published_at", kstDay.startIso)
    .lte("last_published_at", kstDay.endIso);

  if (countError) {
    return commitError("COUNT_FAILED", countError.message, requestId, 500, { supabaseRef }, withNoStoreHeaders());
  }

  const successCountToday = count ?? 0;
  if (successCountToday >= DAILY_PUBLISH_LIMIT) {
    return commitError(
      "PUBLISH_LIMIT_REACHED",
      "오늘은 7개까지 게시할 수 있어요. 선생님께 RID를 보여주세요.",
      requestId,
      409,
      {
        supabaseRef,
        remainingQuota: 0,
        countedSuccessesToday: successCountToday,
        keyType: quotaIdentity.keyType,
        quotaKey: quotaIdentity.quotaKey,
      },
      withNoStoreHeaders(),
    );
  }

  const inProgressSlug = requestedSlug || baseSlug;
  const { data: inProgressProject, error: inProgressProjectError } = await supabase
    .from("edu_projects")
    .select("id,publish_state")
    .eq("slug", inProgressSlug)
    .maybeSingle();

  if (inProgressProjectError) {
    return commitError("SLUG_LOOKUP_FAILED", inProgressProjectError.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  if (inProgressProject?.publish_state === "VALIDATING" || inProgressProject?.publish_state === "PUBLISHING") {
    return commitError(
      "PUBLISH_IN_PROGRESS",
      "이미 게시 작업이 진행 중이에요. 잠시 후 다시 시도해 주세요.",
      requestId,
      409,
      { retryAfterSeconds: 2 },
      withNoStoreHeaders({ headers: { "Retry-After": "2" } }),
    );
  }

  if (inProgressProject?.publish_state === "FAILED") {
    return publishRestartRequired(requestId);
  }

  const nextVersion = requestedVersion ?? 1;

  const origin = await getRequestOriginFn(request.headers);
  const { data: joinCodeRow, error: joinCodeError } = await supabase
    .from("edu_join_codes")
    .select("board_id")
    .eq("code", shareCode)
    .maybeSingle();

  if (joinCodeError) {
    return commitError("JOIN_CODE_LOOKUP_FAILED", joinCodeError.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  const boardId = joinCodeRow?.board_id ?? cookieBoardId ?? payload.boardId ?? null;
  const ttlDays = getEduProjectTtlDays();
  const expiresAt = getEduProjectExpiresAt(new Date(), ttlDays);
  const filesPayload = files.map((file) => ({
    path: file.path,
    content_type: file.contentType,
    size_bytes: file.sizeBytes,
  }));

  const respondAlreadyPublished = async (slug: string, version: number): Promise<Response | null> => {
    try {
      const existing = await findExistingPublishedProject({
        supabase,
        slug,
      });

      if (!existing) {
        return null;
      }

      const published = existing.publish_state === "PUBLISHED" || Boolean(existing.public_url);
      if (!published) {
        return null;
      }

      const resolvedSlug = existing.slug ?? slug;
      const fallbackLinks = buildPublishLinks(origin, resolvedSlug);
      const publish = {
        slug: resolvedSlug,
        version,
        projectId: existing.id,
        previewUrl: existing.preview_url ?? fallbackLinks.previewUrl,
        publicUrl: existing.public_url ?? fallbackLinks.publicUrl,
        classroomUrl: existing.classroom_url ?? fallbackLinks.classroomUrl,
        state: "PUBLISHED",
      };

      console.info("[publish.commit] ok", {
        requestId,
        supabaseRef,
        share_code: shareCode,
        lesson_id: lessonId,
        final_slug: publish.slug,
        version,
        quotaKey: quotaIdentity.quotaKey,
      });

      const response = jsonOkWithRequestId(
        {
          reused: true,
          url: publish.publicUrl,
          publish,
          notice: { code: "ALREADY_PUBLISHED", message: "이미 게시된 링크가 있어요." },
        },
        requestId,
        withNoStoreHeaders(),
      );
      recordManifestEvidenceObservation("reused");
      recordAttemptIdentityObservation("reused");
      recordCapabilityObservation("reused");
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "existing_publish_lookup_failed";
      return commitError(
        "SLUG_CONFLICT_NO_RECORD",
        message,
        requestId,
        409,
        { supabaseRef },
        withNoStoreHeaders(),
      );
    }
  };

  for (let version = nextVersion; version <= (requestedSlug ? nextVersion : 200); version += 1) {
    const slug = requestedSlug || buildEduVersionedSlug(baseSlug, version);
    const links = buildPublishLinks(origin, slug);
    const galleryPreviewUrl = buildGalleryPreviewUrl(slug);

    const { data: existingProject, error: existingProjectError } = await supabase
      .from("edu_projects")
      .select("id,publish_state")
      .eq("slug", slug)
      .maybeSingle();

    if (existingProjectError) {
      return commitError("SLUG_LOOKUP_FAILED", existingProjectError.message, requestId, 500, undefined, withNoStoreHeaders());
    }

    if (existingProject) {
      if (existingProject.publish_state === "FAILED") {
        return publishRestartRequired(requestId);
      }
      const reusedResponse = await respondAlreadyPublished(slug, version);
      if (reusedResponse) {
        return reusedResponse;
      }
      continue;
    }

    const projectInsert = toSnakeKeys({
      shareCode,
      authorName,
      title,
      slug,
      anonId,
      boardId,
      lessonId: dbLessonId,
      expiresAt,
      publishState: "VALIDATING",
      lastValidatedAt: new Date(),
      lastRequestId: requestId,
      publishQuotaKey: quotaIdentity.quotaKey,
    }) as Database["public"]["Tables"]["edu_projects"]["Insert"];

    const { data: project, error: projectError } = await supabase
      .from("edu_projects")
      .insert(projectInsert)
      .select("id")
      .single();

    if (projectError || !project) {
      const message = projectError?.message ?? "Failed to store project";
      if (message.includes("duplicate key")) {
        const { data: concurrentProject, error: concurrentProjectError } = await supabase
          .from("edu_projects")
          .select("id,publish_state")
          .eq("slug", slug)
          .maybeSingle();

        if (concurrentProjectError) {
          logConcurrentProjectLookupFailure(500);
          return commitError(
            "SLUG_LOOKUP_FAILED",
            "게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
            requestId,
            500,
            undefined,
            withNoStoreHeaders(),
          );
        }

        if (concurrentProject?.publish_state === "VALIDATING" || concurrentProject?.publish_state === "PUBLISHING") {
          return commitError(
            "PUBLISH_IN_PROGRESS",
            "이미 게시 작업이 진행 중이에요. 잠시 후 다시 시도해 주세요.",
            requestId,
            409,
            { retryAfterSeconds: 2 },
            withNoStoreHeaders({ headers: { "Retry-After": "2" } }),
          );
        }

        if (concurrentProject?.publish_state === "FAILED") {
          return publishRestartRequired(requestId);
        }

        const reusedResponse = await respondAlreadyPublished(slug, version);
        if (reusedResponse) {
          return reusedResponse;
        }
        continue;
      }
      return commitError("PROJECT_CREATE_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
    }

    const failPublish = async (
      code: string,
      message: string,
      status: number,
      meta?: Record<string, unknown>,
    ) => {
      await supabase
        .from("edu_projects")
        .update({
          publish_state: "FAILED",
          publish_state_reason: code,
          last_request_id: requestId,
        })
        .eq("id", project.id);

      try {
        await insertPublishEvent({
          supabase,
          projectId: project.id,
          state: "FAILED",
          reasonCode: code,
          requestId,
          meta,
        });
      } catch {
        // ignore event failures
      }

      return commitError(code, message, requestId, status, meta ? { meta } : undefined, withNoStoreHeaders());
    };

    try {
      await insertPublishEvent({
        supabase,
        projectId: project.id,
        state: "VALIDATING",
        requestId,
        meta: { slug, shareCode },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "publish_event_failed";
      return await failPublish("PUBLISH_EVENT_FAILED", message, 500, { stage: "validating" });
    }

    const slugPrefix = buildEduPublishPrefix(slug);
    let debugListing: PublishFileDebugListing | undefined;
    let filesForHeadCheck = files.map((file) => ({
      expectedPath: file.path,
      actualPath: file.path,
      sizeBytes: file.sizeBytes,
    }));

    try {
      const listed = await listObjectKeysV2Fn({ prefix: slugPrefix, maxKeys: 200 });
      const relativeKeys = listed.keys
        .filter((key) => key.startsWith(slugPrefix))
        .map((key) => key.slice(slugPrefix.length))
        .filter((key) => key.length > 0);
      const resolved = resolvePublishFilesForCommit({ files, relativeObjectKeys: relativeKeys });
      debugListing = resolved.debug;
      if (resolved.resolved) {
        filesForHeadCheck = resolved.resolved.map((file) => ({
          expectedPath: file.expectedPath,
          actualPath: file.actualPath,
          sizeBytes: file.sizeBytes,
        }));
      }
    } catch {
      // listing is best-effort for root/casing normalization and debug payload
    }

    for (const file of filesForHeadCheck) {
      const r2Key = buildEduPublishObjectKey(slug, file.actualPath);
      let head: Awaited<ReturnType<typeof headObject>>;
      try {
        head = await headObjectFn(r2Key);
      } catch (error) {
        const message = error instanceof Error ? error.message : "r2_head_failed";
        return await failPublish("R2_HEAD_FAILED", message, 502, { path: file.expectedPath });
      }

      if (!head.exists) {
        const r2Target = getR2TargetMetaFn();
        let prefixListingCount = 0;
        let prefixSample: string[] = [];
        let hasObjectsUnderPrefix = false;
        let listedHasIndexPath = false;

        try {
          const listing = await listObjectKeysV2Fn({ prefix: slugPrefix, maxKeys: FILE_MISSING_LIST_MAX_KEYS });
          const relativeKeys = listing.keys
            .filter((key) => key.startsWith(slugPrefix))
            .map((key) => key.slice(slugPrefix.length))
            .filter((key) => key.length > 0);
          prefixListingCount = relativeKeys.length;
          hasObjectsUnderPrefix = relativeKeys.length > 0;
          prefixSample = relativeKeys.slice(0, FILE_MISSING_SAMPLE_MAX);
          listedHasIndexPath = relativeKeys.includes(file.actualPath);
        } catch {
          // best-effort only
        }

        if (listedHasIndexPath) {
          try {
            const retriedHead = await headObjectFn(r2Key);
            if (retriedHead.exists) {
              continue;
            }
          } catch {
            // retry is best-effort only
          }
        }

        void recordOpsEvent(
          toSnakeKeys({
            level: "warn",
            kind: "api_error",
            requestId,
            route: request.nextUrl.pathname,
            status: 400,
            meta: {
              reasonCode: "FILE_MISSING",
              slug,
              checkedKey: r2Key,
              bucketName: r2Target.bucketName,
              r2TargetKind: r2Target.r2TargetKind,
              endpoint: r2Target.endpoint,
              accountId: r2Target.accountId,
              prefix: slugPrefix,
              hasObjectsUnderPrefix,
              prefixListingCount,
              prefixSample,
            },
          }) as Parameters<typeof recordOpsEvent>[0],
          { sampleRate: 1, hardLimitPerMinute: 120 },
        );

        return await failPublish(
          "FILE_MISSING",
          `File missing: ${file.expectedPath}`,
          400,
          fileMissingExtra({
            path: file.expectedPath,
            actualPath: file.actualPath,
            slugPrefix,
            checkedKey: r2Key,
            slug,
            bucketName: r2Target.bucketName,
            r2TargetKind: r2Target.r2TargetKind,
            endpoint: r2Target.endpoint,
            accountId: r2Target.accountId,
            debugListing,
            hasObjectsUnderPrefix,
            prefixListingCount,
            prefixSample,
          }),
        );
      }

      if (head.contentLength && head.contentLength !== file.sizeBytes) {
        return await failPublish("FILE_SIZE_MISMATCH", `File size mismatch: ${file.expectedPath}`, 400, {
          path: file.expectedPath,
          actualPath: file.actualPath,
        });
      }
    }

    const { error: publishingError } = await supabase
      .from("edu_projects")
      .update({
        publish_state: "PUBLISHING",
        publish_state_reason: null,
        last_request_id: requestId,
      })
      .eq("id", project.id);

    if (publishingError) {
      return commitError("PUBLISH_STATE_FAILED", publishingError.message, requestId, 500, undefined, withNoStoreHeaders());
    }

    try {
      await insertPublishEvent({
        supabase,
        projectId: project.id,
        state: "PUBLISHING",
        requestId,
        meta: { slug, shareCode },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "publish_event_failed";
      return await failPublish("PUBLISH_EVENT_FAILED", message, 500, { stage: "publishing" });
    }

    const publishPayload = {
      share_code: shareCode,
      lesson_id: dbLessonId,
      author_name: authorName,
      title,
      in_slug: slug,
      anon_id: anonId,
      board_id: boardId,
      expires_at: expiresAt,
      files: filesPayload,
      preview_url: links.previewUrl,
      gallery_preview_url: galleryPreviewUrl,
      public_url: links.publicUrl,
      classroom_url: links.classroomUrl,
      request_id: requestId,
    };
    const inSlug = resolveInSlug(publishPayload);
    if (!inSlug) {
      return commitError("INVALID_SLUG", "in_slug is required", requestId, 400, undefined, withNoStoreHeaders());
    }

    const { data: publishedProjectId, error: publishError } = await supabase.rpc(EDU_ATOMIC_PUBLISH_RPC_V2, publishPayload);

    if (publishError || !publishedProjectId) {
      const message = publishError?.message ?? "publish_failed";
      const pgCode = typeof publishError?.code === "string" ? publishError.code : null;
      const messageLower = message.toLowerCase();
      const isSlugConflict =
        messageLower.includes("slug already published") ||
        messageLower.includes("duplicate key") ||
        messageLower.includes("unique constraint");
      if (isSlugConflict) {
        const reusedResponse = await respondAlreadyPublished(slug, version);
        if (reusedResponse) {
          return reusedResponse;
        }
        continue;
      }

      const isMissingFunction =
        message.includes("Could not find the function public.edu_atomic_publish_v2") ||
        (message.includes("schema cache") && message.includes("edu_atomic_publish_v2"));
      if (isMissingFunction) {
        return buildDbNotReadyResponse(["function:public.edu_atomic_publish_v2"], message);
      }
      const isDbFunctionBug =
        messageLower.includes("ambiguous") ||
        messageLower.includes("column reference") ||
        message.includes("42P13") ||
        messageLower.includes("cannot change name of input parameter");
      if (isDbFunctionBug) {
        const extra = buildDbFunctionBugExtra({
          rpcName: EDU_ATOMIC_PUBLISH_RPC_V2,
          payload: publishPayload,
          supabaseRef,
          pgCode,
        });
        console.error("[publish.commit] DB_FUNCTION_BUG", {
          requestId,
          ...extra,
        });
        return commitError(
          "DB_FUNCTION_BUG",
          "서버 게시 기능(DB 함수)에 문제가 있어요. 선생님께 RID를 보여주세요.",
          requestId,
          500,
          { detail: message, ...extra },
          withNoStoreHeaders(),
        );
      }
      logR2DatabaseBoundaryFailure(500);
      return await failPublish("PUBLISH_FAILED", "publish_failed", 500, { stage: "atomic_publish" });
    }

    let assignmentSubmission: AssignmentSubmissionResult | null = null;

    if (assignmentId) {
      assignmentSubmission = await recordAssignmentSubmission({
        supabase,
        assignmentId,
        shareCode,
        anonId,
        studentName: authorName,
        slug,
        lessonId,
        viewUrl: links.publicUrl,
        requestId,
        route: request.nextUrl.pathname,
      });
    }

    const lessonKey = getLessonIdFromNumber(lessonId);
    let galleryDegraded = false;
    if (lessonKey) {
      const nowIso = new Date().toISOString();
      const { error: galleryError } = await supabase.from("edu_gallery").upsert(
        {
          class_code: shareCode,
          view_id: studentKey,
          lesson_key: lessonKey,
          title,
          author_name: authorName,
          preview_url: galleryPreviewUrl,
          updated_at: nowIso,
        },
        { onConflict: "view_id" },
      );

      if (galleryError) {
        galleryDegraded = true;
        console.warn("[publish.commit] gallery upsert failed", {
          requestId,
          supabaseRef,
          share_code: shareCode,
          lesson_id: lessonId,
          final_slug: slug,
          version,
        });
      }
    }

    console.info("[publish.commit] ok", {
      requestId,
      supabaseRef,
      share_code: shareCode,
      lesson_id: lessonId,
      final_slug: slug,
      version,
      quotaKey: quotaIdentity.quotaKey,
    });

    const response = jsonOkWithRequestId(
      {
        url: links.publicUrl,
        state: "PUBLISHED",
        links,
        publish: { slug, version, previewUrl: links.previewUrl, publicUrl: links.publicUrl, classroomUrl: links.classroomUrl },
        reused: false,
        notice: { code: "PUBLISHED" },
        submission: assignmentSubmission,
      },
      requestId,
      withNoStoreHeaders(),
    );
    recordManifestEvidenceObservation(galleryDegraded ? "degraded" : "published");
    recordAttemptIdentityObservation(galleryDegraded ? "degraded" : "published");
    recordCapabilityObservation(galleryDegraded ? "degraded" : "published");
    return response;
  }

  return commitError(
    "SLUG_CONFLICT",
    "게시 주소가 계속 겹쳐서 실패했어요. 선생님께 RID를 보여주세요.",
    requestId,
    409,
    { supabaseRef },
    withNoStoreHeaders(),
  );
}
