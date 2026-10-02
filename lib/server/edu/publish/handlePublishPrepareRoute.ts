import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { basicHtmlFilter } from "@/lib/edu/safety/filter";
import { classifyPublishAttemptCompatibility } from "@/lib/edu/publish/attemptCompatibility";
import {
  signEduPublishCommitCapability,
  type SignEduPublishCommitCapabilityResult,
} from "@/lib/edu/publish/commitCapability";
import {
  classifyPublishPrepareManifestEvidence,
  type DeclaredPrepareManifestEvidenceV1,
  type PublishPrepareManifestEvidenceCompatibility,
} from "@/lib/edu/publish/prepareManifestEvidence";
import type { CanonicalPublishManifest } from "@/lib/edu/publish/manifest";
import {
  validateEduPublishFiles,
  type EduPublishFileMetaInput,
  type EduPublishFileMetaNormalized,
} from "@/lib/edu/validateFiles";
import { buildEduPublishObjectKey, buildEduPublishPrefix } from "@/lib/edu/publish/objectKey";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { getR2TargetMeta, prefixExists, presignPutUrl } from "@/lib/r2/client";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { loadEduPublishCapabilityKeyRing } from "@/lib/server/edu/publish/commitCapabilityRuntime";
import {
  coordinateEduPublishSecuredPrepare,
  type EduPublishSecuredPrepareCoordinatorResult,
} from "@/lib/server/edu/publish/prepareAttemptCoordinator";
import {
  loadEduPublishPrepareAttemptMode,
  type EduPublishPrepareAttemptModeRuntimeResult,
} from "@/lib/server/edu/publish/prepareAttemptRolloutRuntime";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildEduBaseSlug, buildEduVersionedSlug } from "@/lib/share/slug";

const PUT_URL_EXPIRES_SECONDS = 10 * 60;

export type PrepareBody = {
  shareCode?: string;
  authorName?: string;
  title?: string;
  files?: EduPublishFileMetaInput[];
  anonId?: string | null;
  lessonId?: number | string | null;
  manifestSchemaVersion?: unknown;
  declaredManifestDigest?: unknown;
  declaredManifest?: unknown;
};

type PrepareDependencies = {
  findAvailableSlugFn?: typeof findAvailableSlug;
  recordOpsEventFn?: typeof recordOpsEvent;
  checkRateLimitFn?: typeof checkRateLimit;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  presignPutUrlFn?: typeof presignPutUrl;
  classifyPublishPrepareManifestEvidenceFn?: typeof classifyPublishPrepareManifestEvidence;
  loadPrepareAttemptModeFn?: typeof loadEduPublishPrepareAttemptMode;
  coordinateSecuredPrepareFn?: typeof coordinateEduPublishSecuredPrepare;
  createPublishAttemptIdFn?: () => string;
  loadPublishCapabilityKeyRingFn?: typeof loadEduPublishCapabilityKeyRing;
  signPublishCapabilityFn?: typeof signEduPublishCommitCapability;
  nowSecondsFn?: () => number;
};

type PublishPrepareObservationClassification =
  | "legacy"
  | "declared_v1"
  | "partial"
  | "invalid"
  | "unsupported_schema"
  | "digest_mismatch"
  | "metadata_mismatch"
  | "evaluation_failed";

type PublishPrepareEvidenceObservation = {
  classification: PublishPrepareObservationClassification;
  evidence: DeclaredPrepareManifestEvidenceV1 | null;
};

type PublishPrepareAttemptResponseFields =
  | {
      publishAttemptId: string;
      declaredManifestDigest: string;
      manifestSchemaVersion: 1;
    }
  | Record<string, never>;

type PublishPrepareCapabilityResponseFields =
  | { publishCapability: string }
  | Record<string, never>;

type PublishPrepareCapabilityIssuanceClassification =
  | "not_eligible"
  | "issued_v2"
  | "configuration_unavailable"
  | "invalid_input"
  | "evaluation_failed";

function isPublishDebugEnabled(): boolean {
  if (readEnvString("EDU_PUBLISH_DEBUG_META") === "1") {
    return true;
  }
  return (readEnvString("NODE_ENV") ?? "development") !== "production";
}

function matchesPreparedFileMetadata(
  manifestFiles: CanonicalPublishManifest["files"],
  normalizedFiles: EduPublishFileMetaNormalized[],
): boolean {
  if (manifestFiles.length !== normalizedFiles.length) return false;

  const normalizedByPath = new Map(normalizedFiles.map((file) => [file.path, file]));
  return manifestFiles.every((manifestFile) => {
    const normalizedFile = normalizedByPath.get(manifestFile.path);
    return Boolean(
      normalizedFile &&
        normalizedFile.sizeBytes === manifestFile.sizeBytes &&
        normalizedFile.contentType === manifestFile.contentType,
    );
  });
}

function toPublishPrepareEvidenceObservation(
  result: PublishPrepareManifestEvidenceCompatibility,
  normalizedFiles: EduPublishFileMetaNormalized[],
): PublishPrepareEvidenceObservation {
  if (result.mode !== "declared_v1") return { classification: result.mode, evidence: null };
  if (!matchesPreparedFileMetadata(result.evidence.declaredManifest.files, normalizedFiles)) {
    return { classification: "metadata_mismatch", evidence: null };
  }
  return {
    classification: "declared_v1",
    evidence: result.evidence,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidSecuredPrepareSuccess(
  value: unknown,
  evidence: DeclaredPrepareManifestEvidenceV1,
): value is Extract<EduPublishSecuredPrepareCoordinatorResult, { mode: "prepared" }> {
  if (!isPlainObject(value)) return false;
  return (
    value.mode === "prepared" &&
    typeof value.slug === "string" &&
    value.slug.length > 0 &&
    typeof value.publishAttemptId === "string" &&
    value.publishAttemptId.length > 0 &&
    typeof value.publishCapability === "string" &&
    value.publishCapability.length > 0 &&
    value.manifestSchemaVersion === 1 &&
    value.declaredManifestDigest === evidence.declaredManifestDigest &&
    Number.isSafeInteger(value.attemptVersion) &&
    (value.attemptVersion as number) >= 0 &&
    typeof value.expiresAt === "string" &&
    value.expiresAt.length > 0 &&
    (value.rpcOutcome === "CREATED" || value.rpcOutcome === "ALREADY_PREPARED")
  );
}

type SecuredPrepareFailureMapping = {
  code: string;
  message: string;
  status: number;
  mappedReason:
    | "evidence_required"
    | "evidence_evaluation_failed"
    | "invalid_lesson"
    | "slug_exhausted"
    | "prefix_lookup_failed"
    | "unavailable"
    | "contract_failure"
    | "upload_url_failed";
};

function mapSecuredPrepareCoordinatorFailure(value: unknown): SecuredPrepareFailureMapping {
  const reason = isPlainObject(value) && value.mode === "failed" && typeof value.reason === "string"
    ? value.reason
    : null;

  if (reason === "slug_exhausted") {
    return {
      code: "SLUG_EXHAUSTED",
      message: "게시 주소를 더 만들 수 없어요. 선생님께 RID를 보여주세요.",
      status: 409,
      mappedReason: "slug_exhausted",
    };
  }
  if (reason === "prefix_lookup_failed") {
    return {
      code: "SLUG_LOOKUP_FAILED",
      message: "게시 주소를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      status: 500,
      mappedReason: "prefix_lookup_failed",
    };
  }
  if (
    reason === "capability_configuration_unavailable" ||
    reason === "capability_signing_failed" ||
    reason === "rpc_unavailable"
  ) {
    return {
      code: "PUBLISH_PREPARE_UNAVAILABLE",
      message: "게시 준비 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.",
      status: 503,
      mappedReason: "unavailable",
    };
  }
  return {
    code: "PUBLISH_PREPARE_CONTRACT_FAILED",
    message: "게시 준비 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
    status: 500,
    mappedReason: "contract_failure",
  };
}

function buildPublishPrepareAttemptResponseFields(
  observation: PublishPrepareEvidenceObservation,
  createPublishAttemptIdFn: () => string,
): PublishPrepareAttemptResponseFields {
  if (observation.classification !== "declared_v1" || !observation.evidence) return {};

  let publishAttemptId: string;
  try {
    publishAttemptId = createPublishAttemptIdFn();
  } catch {
    return {};
  }

  const compatibility = classifyPublishAttemptCompatibility({
    publishAttemptId,
    declaredManifestDigest: observation.evidence.declaredManifestDigest,
    manifestSchemaVersion: observation.evidence.manifestSchemaVersion,
  });
  return compatibility.mode === "attempt_v1" ? compatibility.evidence : {};
}

async function issuePublishPrepareCapability({
  attemptResponseFields,
  slug,
  loadPublishCapabilityKeyRingFn,
  signPublishCapabilityFn,
  nowSecondsFn,
}: {
  attemptResponseFields: PublishPrepareAttemptResponseFields;
  slug: string;
  loadPublishCapabilityKeyRingFn: typeof loadEduPublishCapabilityKeyRing;
  signPublishCapabilityFn: typeof signEduPublishCommitCapability;
  nowSecondsFn: () => number;
}): Promise<{
  classification: PublishPrepareCapabilityIssuanceClassification;
  responseFields: PublishPrepareCapabilityResponseFields;
}> {
  if (!Object.hasOwn(attemptResponseFields, "publishAttemptId")) {
    return { classification: "not_eligible", responseFields: {} };
  }

  try {
    const keyRingResult = loadPublishCapabilityKeyRingFn();
    if (keyRingResult.mode === "configuration_unavailable") {
      return { classification: "configuration_unavailable", responseFields: {} };
    }

    const signResult: SignEduPublishCommitCapabilityResult = await signPublishCapabilityFn({
      keyRing: keyRingResult.keyRing,
      nowSeconds: nowSecondsFn(),
      publishAttemptId: attemptResponseFields.publishAttemptId,
      slug,
      declaredManifestDigest: attemptResponseFields.declaredManifestDigest,
      manifestSchemaVersion: attemptResponseFields.manifestSchemaVersion,
    });

    if (signResult.ok) {
      return {
        classification: "issued_v2",
        responseFields: { publishCapability: signResult.token },
      };
    }

    return {
      classification: signResult.reason,
      responseFields: {},
    };
  } catch {
    return { classification: "evaluation_failed", responseFields: {} };
  }
}

async function slugExists(slug: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("edu_projects").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function findAvailableSlug(baseSlug: string, startVersion: number): Promise<string> {
  for (let version = startVersion; version <= 200; version += 1) {
    const candidate = buildEduVersionedSlug(baseSlug, version);
    const [dbExists, r2Exists] = await Promise.all([slugExists(candidate), prefixExists(`edu/v1/${candidate}/`)]);
    if (!dbExists && !r2Exists) {
      return candidate;
    }
  }

  throw new Error("SLUG_EXHAUSTED");
}

export async function handlePublishPrepareRoute({
  request,
  requestId,
  payload,
  dependencies = {},
}: {
  request: NextRequest;
  requestId: string;
  payload: PrepareBody | null;
  dependencies?: PrepareDependencies;
} ): Promise<Response> {
  const findAvailableSlugFn = dependencies.findAvailableSlugFn ?? findAvailableSlug;
  const recordOpsEventFn = dependencies.recordOpsEventFn ?? recordOpsEvent;
  const checkRateLimitFn = dependencies.checkRateLimitFn ?? checkRateLimit;
  const createSupabaseAdminClientFn = dependencies.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const presignPutUrlFn = dependencies.presignPutUrlFn ?? presignPutUrl;
  const classifyPublishPrepareManifestEvidenceFn =
    dependencies.classifyPublishPrepareManifestEvidenceFn ?? classifyPublishPrepareManifestEvidence;
  const loadPrepareAttemptModeFn = dependencies.loadPrepareAttemptModeFn ?? loadEduPublishPrepareAttemptMode;
  const coordinateSecuredPrepareFn = dependencies.coordinateSecuredPrepareFn ?? coordinateEduPublishSecuredPrepare;
  const createPublishAttemptIdFn = dependencies.createPublishAttemptIdFn ?? (() => globalThis.crypto.randomUUID());
  const loadPublishCapabilityKeyRingFn =
    dependencies.loadPublishCapabilityKeyRingFn ?? loadEduPublishCapabilityKeyRing;
  const signPublishCapabilityFn = dependencies.signPublishCapabilityFn ?? signEduPublishCommitCapability;
  const nowSecondsFn = dependencies.nowSecondsFn ?? (() => Math.floor(Date.now() / 1000));

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const shareCode = normalizeShareCode(payload.shareCode ?? "");
  if (!isLikelyShareCode(shareCode)) {
    return jsonErrorWithRequestId("INVALID_SHARE_CODE", "shareCode is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const authorName = typeof payload.authorName === "string" ? payload.authorName.trim() : "";
  if (!authorName) {
    return jsonErrorWithRequestId("INVALID_AUTHOR", "authorName is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return jsonErrorWithRequestId("INVALID_TITLE", "title is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const lessonIdRaw = typeof payload.lessonId === "string" ? Number(payload.lessonId) : payload.lessonId;
  const lessonId = Number.isFinite(lessonIdRaw) ? Number(lessonIdRaw) : null;
  if (lessonId === null || lessonId < 0 || lessonId > 4) {
    return jsonErrorWithRequestId("INVALID_LESSON_ID", "lessonId is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const validation = validateEduPublishFiles(payload.files ?? []);
  if (!validation.ok) {
    return jsonErrorWithRequestId(validation.code, validation.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const payloadAnonId = typeof payload.anonId === "string" ? payload.anonId.trim() : null;
  const cookieAnonId = request.cookies.get("edu_anon_id")?.value?.trim() ?? null;
  const anonId = payloadAnonId || cookieAnonId || null;
  const baseSlug = buildEduBaseSlug({ shareCode, anonId, requestId, lessonId });

  const htmlFilter = basicHtmlFilter(validation.normalized.map((file) => ({ path: file.path, contentType: file.contentType })));
  if (!htmlFilter.ok) {
    void recordOpsEventFn(
      {
        level: "warn",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: { shareCode, slug: baseSlug, lessonId },
      },
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );

    return jsonErrorWithRequestId(htmlFilter.code, htmlFilter.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const subject = await getRateLimitSubject(request, anonId ?? null);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimitFn(createSupabaseAdminClientFn() as unknown as Parameters<typeof checkRateLimit>[0], {
      key: `edu:publish:prepare:${shareCode || "na"}:${subject}`,
      windowSeconds: 60,
      limit: 6,
    });
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEventFn(
      {
        level: "warn",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: { shareCode, slug: baseSlug, lessonId },
      },
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  let evidenceObservation: PublishPrepareEvidenceObservation = {
    classification: "evaluation_failed",
    evidence: null,
  };
  try {
    evidenceObservation = toPublishPrepareEvidenceObservation(
      await classifyPublishPrepareManifestEvidenceFn(payload),
      validation.normalized,
    );
  } catch {
    evidenceObservation = { classification: "evaluation_failed", evidence: null };
  }

  let prepareAttemptMode: EduPublishPrepareAttemptModeRuntimeResult;
  try {
    prepareAttemptMode = loadPrepareAttemptModeFn();
  } catch {
    prepareAttemptMode = {
      mode: "legacy",
      source: "evaluation_failed_fallback",
    };
  }

  const files = validation.normalized;

  if (prepareAttemptMode.mode === "secured_v1") {
    const recordSecuredFailure = (failure: SecuredPrepareFailureMapping) => {
      void Promise.resolve()
        .then(() =>
          recordOpsEventFn(
            {
              level: "error",
              kind: "api_error",
              requestId,
              route: request.nextUrl.pathname,
              status: failure.status,
              meta: {
                stage: "edu_publish_prepare",
                component: "secured_prepare",
                result: "failed",
                mappedReason: failure.mappedReason,
              },
            },
            { sampleRate: 1, hardLimitPerMinute: 120 },
          ),
        )
        .catch(() => undefined);
    };

    const securedLessonId =
      lessonId === 1 || lessonId === 2 || lessonId === 3 || lessonId === 4
        ? lessonId
        : null;
    if (securedLessonId === null) {
      const failure: SecuredPrepareFailureMapping = {
        code: "INVALID_LESSON_ID",
        message: "lessonId must be between 1 and 4",
        status: 400,
        mappedReason: "invalid_lesson",
      };
      recordSecuredFailure(failure);
      return jsonErrorWithRequestId(
        failure.code,
        failure.message,
        requestId,
        failure.status,
        undefined,
        withNoStoreHeaders(),
      );
    }

    if (evidenceObservation.classification !== "declared_v1" || !evidenceObservation.evidence) {
      const failure: SecuredPrepareFailureMapping =
        evidenceObservation.classification === "evaluation_failed"
          ? {
              code: "PUBLISH_PREPARE_CONTRACT_FAILED",
              message: "게시 준비 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
              status: 500,
              mappedReason: "evidence_evaluation_failed",
            }
          : {
              code: "SECURED_PREPARE_EVIDENCE_REQUIRED",
              message: "게시 파일 정보를 확인할 수 없어요. 파일을 다시 준비해 주세요.",
              status: 400,
              mappedReason: "evidence_required",
            };
      recordSecuredFailure(failure);
      return jsonErrorWithRequestId(
        failure.code,
        failure.message,
        requestId,
        failure.status,
        undefined,
        withNoStoreHeaders(),
      );
    }

    let securedResult: unknown;
    try {
      securedResult = await coordinateSecuredPrepareFn({
        baseSlug,
        lessonId: securedLessonId,
        evidence: evidenceObservation.evidence,
      });
    } catch {
      securedResult = null;
    }

    if (!isValidSecuredPrepareSuccess(securedResult, evidenceObservation.evidence)) {
      const failure = mapSecuredPrepareCoordinatorFailure(securedResult);
      recordSecuredFailure(failure);
      return jsonErrorWithRequestId(
        failure.code,
        failure.message,
        requestId,
        failure.status,
        undefined,
        withNoStoreHeaders(),
      );
    }

    const securedSlug = securedResult.slug;
    const uploads: Array<{ path: string; putUrl: string }> = [];
    try {
      for (const file of files) {
        uploads.push({
          path: file.path,
          putUrl: await presignPutUrlFn({
            key: buildEduPublishObjectKey(securedSlug, file.path),
            contentType: file.contentType,
            expiresSeconds: PUT_URL_EXPIRES_SECONDS,
          }),
        });
      }
    } catch {
      const failure: SecuredPrepareFailureMapping = {
        code: "UPLOAD_URL_FAILED",
        message: "업로드 주소를 만들지 못했어요. 새 게시를 시작해 주세요.",
        status: 500,
        mappedReason: "upload_url_failed",
      };
      recordSecuredFailure(failure);
      return jsonErrorWithRequestId(
        failure.code,
        failure.message,
        requestId,
        failure.status,
        undefined,
        withNoStoreHeaders(),
      );
    }

    const totalBytes = files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
    void recordOpsEventFn(
      {
        level: "info",
        kind: "api_access",
        requestId,
        route: request.nextUrl.pathname,
        status: 200,
        meta: {
          stage: "edu_publish_prepare",
          shareCode,
          fileCount: files.length,
          totalBytes,
          slug: securedSlug,
          result: "success",
        },
      },
      { sampleRate: 10, hardLimitPerMinute: 120 },
    );

    const r2Target = getR2TargetMeta();
    const debugMeta = isPublishDebugEnabled()
      ? {
          debug: {
            bucketName: r2Target.bucketName,
            r2TargetKind: r2Target.r2TargetKind,
            endpoint: r2Target.endpoint,
            prefix: buildEduPublishPrefix(securedSlug),
          },
        }
      : {};

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
              stage: "edu_publish_prepare",
              component: "manifest_evidence",
              result: "observed",
              classification: evidenceObservation.classification,
            },
          },
          { sampleRate: 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);

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
              stage: "edu_publish_prepare",
              component: "commit_capability_issuance",
              result: "observed",
              classification: "issued_v2",
            },
          },
          { sampleRate: 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);

    return jsonOkWithRequestId(
      {
        slug: securedSlug,
        uploads,
        meta: { bucketName: r2Target.bucketName, r2TargetKind: r2Target.r2TargetKind, ...debugMeta },
        publishAttemptId: securedResult.publishAttemptId,
        declaredManifestDigest: securedResult.declaredManifestDigest,
        manifestSchemaVersion: securedResult.manifestSchemaVersion,
        publishCapability: securedResult.publishCapability,
      },
      requestId,
      withNoStoreHeaders(),
    );
  }

  let slug: string;
  try {
    slug = await findAvailableSlugFn(baseSlug, 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SLUG_LOOKUP_FAILED";
    if (message === "SLUG_EXHAUSTED") {
      return jsonErrorWithRequestId(
        "SLUG_EXHAUSTED",
        "게시 주소를 더 만들 수 없어요. 선생님께 RID를 보여주세요.",
        requestId,
        409,
        undefined,
        withNoStoreHeaders(),
      );
    }

    void Promise.resolve()
      .then(() =>
        recordOpsEventFn(
          {
            level: "error",
            kind: "api_error",
            requestId,
            route: request.nextUrl.pathname,
            status: 500,
            meta: {
              stage: "edu_publish_prepare",
              component: "slug_availability",
              result: "failed",
              mappedReason: "slug_lookup_failed",
            },
          },
          { sampleRate: 1, hardLimitPerMinute: 120 },
        ),
      )
      .catch(() => undefined);
    return jsonErrorWithRequestId(
      "SLUG_LOOKUP_FAILED",
      "게시 주소를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const uploads = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      putUrl: await presignPutUrlFn({
        key: buildEduPublishObjectKey(slug, file.path),
        contentType: file.contentType,
        expiresSeconds: PUT_URL_EXPIRES_SECONDS,
      }),
    })),
  );

  const totalBytes = files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  void recordOpsEventFn(
    {
      level: "info",
      kind: "api_access",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_publish_prepare",
        shareCode,
        fileCount: files.length,
        totalBytes,
        slug,
        result: "success",
      },
    },
    { sampleRate: 10, hardLimitPerMinute: 120 },
  );

  const r2Target = getR2TargetMeta();
  const debugMeta = isPublishDebugEnabled()
    ? {
        debug: {
          bucketName: r2Target.bucketName,
          r2TargetKind: r2Target.r2TargetKind,
          endpoint: r2Target.endpoint,
          prefix: buildEduPublishPrefix(slug),
        },
      }
    : {};

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
            stage: "edu_publish_prepare",
            component: "manifest_evidence",
            result: "observed",
            classification: evidenceObservation.classification,
          },
        },
        { sampleRate: evidenceObservation.classification === "legacy" ? 10 : 1, hardLimitPerMinute: 120 },
      ),
    )
    .catch(() => undefined);

  const attemptResponseFields = buildPublishPrepareAttemptResponseFields(
    evidenceObservation,
    createPublishAttemptIdFn,
  );
  const capabilityIssuance = await issuePublishPrepareCapability({
    attemptResponseFields,
    slug,
    loadPublishCapabilityKeyRingFn,
    signPublishCapabilityFn,
    nowSecondsFn,
  });

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
            stage: "edu_publish_prepare",
            component: "commit_capability_issuance",
            result: "observed",
            classification: capabilityIssuance.classification,
          },
        },
        {
          sampleRate: capabilityIssuance.classification === "not_eligible" ? 10 : 1,
          hardLimitPerMinute: 120,
        },
      ),
    )
    .catch(() => undefined);

  return jsonOkWithRequestId(
    {
      slug,
      uploads,
      meta: { bucketName: r2Target.bucketName, r2TargetKind: r2Target.r2TargetKind, ...debugMeta },
      ...attemptResponseFields,
      ...capabilityIssuance.responseFields,
    },
    requestId,
    withNoStoreHeaders(),
  );
}
