/**
 * This contract validates the server-generated project publication payload
 * for the secured complete publish transaction.
 *
 * Attempt state, lease, reservation, capability, and verified digest binding
 * are handled by completeCommitContract.
 * Actual project, file, gallery, event, reservation, and attempt mutations
 * belong in one database transaction.
 */

import {
  EDU_PUBLISH_DEFAULT_MAX_FILES,
  EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES,
  EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES,
  validateEduPublishFiles,
  type EduPublishFileMetaInput,
  type EduPublishFileMetaNormalized,
} from "@/lib/edu/validateFiles";
import {
  isLikelyShareCode,
  normalizeShareCode,
} from "@/lib/student/shareCode";
import {
  buildPublishQuotaIdentity,
} from "@/lib/edu/publish/quota";

export type EduPublishCompleteProjectPayloadInput = {
  projectId: unknown;
  slug: unknown;
  shareCode: unknown;
  lessonId: unknown;
  authorName: unknown;
  title: unknown;
  anonId: unknown;
  boardId: unknown;
  expiresAt: unknown;
  files: unknown;
  previewUrl: unknown;
  galleryPreviewUrl: unknown;
  publicUrl: unknown;
  classroomUrl: unknown;
  requestId: unknown;
  publishQuotaKey: unknown;
};

export type EduPublishCompleteProjectPayload = {
  projectId: string;
  slug: string;
  shareCode: string;
  lessonId: 1 | 2 | 3 | 4;
  authorName: string;
  title: string;
  anonId: string | null;
  boardId: string | null;
  expiresAt: string;
  files: EduPublishFileMetaNormalized[];
  previewUrl: string;
  galleryPreviewUrl: string;
  publicUrl: string;
  classroomUrl: string;
  requestId: string;
  publishQuotaKey: string;
};

export type EduPublishCompleteProjectPayloadValidation =
  | {
      ok: true;
      payload: EduPublishCompleteProjectPayload;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "invalid_project"
        | "invalid_slug"
        | "invalid_share_code"
        | "invalid_lesson"
        | "invalid_author"
        | "invalid_title"
        | "invalid_anon"
        | "invalid_board"
        | "invalid_expiry"
        | "invalid_files"
        | "invalid_preview_url"
        | "invalid_gallery_url"
        | "invalid_public_url"
        | "invalid_classroom_url"
        | "invalid_request"
        | "invalid_quota_key";
    };

type PlainObject = Record<string, unknown>;
type LessonId = 1 | 2 | 3 | 4;
type ProjectPayloadFailure = Exclude<
  EduPublishCompleteProjectPayloadValidation,
  { ok: true }
>["reason"];

const PROJECT_PAYLOAD_KEYS = [
  "projectId",
  "slug",
  "shareCode",
  "lessonId",
  "authorName",
  "title",
  "anonId",
  "boardId",
  "expiresAt",
  "files",
  "previewUrl",
  "galleryPreviewUrl",
  "publicUrl",
  "classroomUrl",
  "requestId",
  "publishQuotaKey",
] as const;

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHARE_CODE_INPUT = /^[A-Za-z0-9]{4,8}$/;
const EXPLICIT_TIME_ZONE = /(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

function failure(reason: ProjectPayloadFailure): EduPublishCompleteProjectPayloadValidation {
  return { ok: false, reason };
}

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value: PlainObject): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === PROJECT_PAYLOAD_KEYS.length &&
    ownKeys.every(
      (key) =>
        typeof key === "string" && PROJECT_PAYLOAD_KEYS.includes(key as (typeof PROJECT_PAYLOAD_KEYS)[number]),
    ) &&
    PROJECT_PAYLOAD_KEYS.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  );
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

function isValidPublishQuotaKey(input: {
  value: unknown;
  shareCode: string;
  lessonId: LessonId;
  authorName: string;
}): input is {
  value: string;
  shareCode: string;
  lessonId: LessonId;
  authorName: string;
} {
  if (
    typeof input.value !== "string" ||
    input.value.length === 0 ||
    input.value.trim() !== input.value
  ) {
    return false;
  }

  const expectedGuestQuotaKey = buildPublishQuotaIdentity({
    userId: null,
    shareCode: input.shareCode,
    lessonId: input.lessonId,
    authorName: input.authorName,
  }).quotaKey;
  if (input.value === expectedGuestQuotaKey) {
    return true;
  }

  const authenticatedMatch = /^uid:([^:]+):([^:]+):p([^:]+)$/.exec(input.value);
  if (authenticatedMatch === null) {
    return false;
  }

  return (
    isCanonicalUuid(authenticatedMatch[1]) &&
    authenticatedMatch[2] === input.shareCode &&
    authenticatedMatch[3] === String(input.lessonId)
  );
}

function isLessonId(value: unknown): value is LessonId {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 4
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRelatedSlug(
  value: unknown,
  shareCode: string,
  lessonId: LessonId,
): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) {
    return false;
  }

  const version = "(?:[2-9]|[1-9][0-9]|1[0-9]{2}|200)";
  const pattern = new RegExp(
    `^${escapeRegExp(shareCode)}-[a-z0-9]{6}-p${lessonId}(?:-v${version})?$`,
  );
  return pattern.test(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeNullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  const normalized = normalizeText(value);
  return normalized ?? undefined;
}

function isValidExpiry(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    EXPLICIT_TIME_ZONE.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasValidFileSizes(files: unknown[]): boolean {
  return files.every((file) => {
    if (typeof file !== "object" || file === null || Array.isArray(file)) {
      return false;
    }

    const sizeBytes = (file as { sizeBytes?: unknown }).sizeBytes;
    return sizeBytes === undefined || (
      typeof sizeBytes === "number" &&
      Number.isSafeInteger(sizeBytes) &&
      sizeBytes >= 0
    );
  });
}

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function hasOnlyQuery(url: URL, key: string, expectedValue: string): boolean {
  const entries = Array.from(url.searchParams.entries());
  return entries.length === 1 && entries[0]?.[0] === key && entries[0]?.[1] === expectedValue;
}

function hasExpectedProjectPath(url: URL, slug: string): boolean {
  return url.pathname === `/edu/view/${slug}/`;
}

export function validateEduPublishCompleteProjectPayload(
  value: unknown,
): EduPublishCompleteProjectPayloadValidation {
  if (!isPlainObject(value) || !hasExactOwnKeys(value)) {
    return failure("invalid_payload");
  }

  if (!isCanonicalUuid(value.projectId)) {
    return failure("invalid_project");
  }

  if (typeof value.shareCode !== "string") {
    return failure("invalid_share_code");
  }
  const shareCode = normalizeShareCode(value.shareCode);
  if (!SHARE_CODE_INPUT.test(value.shareCode.trim()) || !isLikelyShareCode(shareCode)) {
    return failure("invalid_share_code");
  }

  if (!isLessonId(value.lessonId)) {
    return failure("invalid_lesson");
  }

  if (!isRelatedSlug(value.slug, shareCode, value.lessonId)) {
    return failure("invalid_slug");
  }
  const slug = value.slug;

  const authorName = normalizeText(value.authorName);
  if (authorName === null) {
    return failure("invalid_author");
  }

  const title = normalizeText(value.title);
  if (title === null) {
    return failure("invalid_title");
  }

  const anonId = normalizeNullableText(value.anonId);
  if (anonId === undefined) {
    return failure("invalid_anon");
  }

  if (value.boardId !== null && !isCanonicalUuid(value.boardId)) {
    return failure("invalid_board");
  }
  const boardId = value.boardId;

  if (!isValidExpiry(value.expiresAt)) {
    return failure("invalid_expiry");
  }

  if (!Array.isArray(value.files) || !hasValidFileSizes(value.files)) {
    return failure("invalid_files");
  }
  const fileValidation = validateEduPublishFiles(
    value.files as EduPublishFileMetaInput[],
    {
      maxFiles: EDU_PUBLISH_DEFAULT_MAX_FILES,
      maxTotalBytes: EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES,
      maxSingleBytes: EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES,
    },
  );
  if (!fileValidation.ok) {
    return failure("invalid_files");
  }
  const files = fileValidation.normalized.map((file) => ({
    path: file.path,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
  }));

  const publicUrl = parseHttpUrl(value.publicUrl);
  if (publicUrl === null || publicUrl.search !== "" || !hasExpectedProjectPath(publicUrl, slug)) {
    return failure("invalid_public_url");
  }

  const previewUrl = parseHttpUrl(value.previewUrl);
  if (
    previewUrl === null ||
    !hasOnlyQuery(previewUrl, "preview", "1") ||
    !hasExpectedProjectPath(previewUrl, slug) ||
    previewUrl.origin !== publicUrl.origin
  ) {
    return failure("invalid_preview_url");
  }

  const classroomUrl = parseHttpUrl(value.classroomUrl);
  if (
    classroomUrl === null ||
    !hasOnlyQuery(classroomUrl, "classroom", "1") ||
    !hasExpectedProjectPath(classroomUrl, slug) ||
    classroomUrl.origin !== publicUrl.origin
  ) {
    return failure("invalid_classroom_url");
  }

  const galleryPreviewUrl = parseHttpUrl(value.galleryPreviewUrl);
  if (
    galleryPreviewUrl === null ||
    galleryPreviewUrl.search !== "" ||
    galleryPreviewUrl.pathname !== `/v1/${slug}/thumb.png`
  ) {
    return failure("invalid_gallery_url");
  }

  const requestId = normalizeText(value.requestId);
  if (requestId === null) {
    return failure("invalid_request");
  }

  const quotaKeyInput = {
    value: value.publishQuotaKey,
    shareCode,
    lessonId: value.lessonId,
    authorName,
  };
  if (!isValidPublishQuotaKey(quotaKeyInput)) {
    return failure("invalid_quota_key");
  }

  return {
    ok: true,
    payload: {
      projectId: value.projectId,
      slug,
      shareCode,
      lessonId: value.lessonId,
      authorName,
      title,
      anonId,
      boardId,
      expiresAt: value.expiresAt,
      files,
      previewUrl: previewUrl.toString(),
      galleryPreviewUrl: galleryPreviewUrl.toString(),
      publicUrl: publicUrl.toString(),
      classroomUrl: classroomUrl.toString(),
      requestId,
      publishQuotaKey: quotaKeyInput.value,
    },
  };
}
