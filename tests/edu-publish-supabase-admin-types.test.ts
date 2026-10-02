import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

import {
  EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES,
} from "@/lib/edu/publish/completeCommitContract";
import {
  EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES,
  EDU_PUBLISH_FAIL_COMMIT_OUTCOMES,
} from "@/lib/edu/publish/failCommitContract";
import type { Database } from "@/lib/supabase/admin";

type ReservationRow =
  Database["public"]["Tables"]["edu_publish_slug_reservations"]["Row"];
type ReservationInsert =
  Database["public"]["Tables"]["edu_publish_slug_reservations"]["Insert"];
type ReservationUpdate =
  Database["public"]["Tables"]["edu_publish_slug_reservations"]["Update"];
type AttemptRow = Database["public"]["Tables"]["edu_publish_attempts"]["Row"];
type AttemptInsert =
  Database["public"]["Tables"]["edu_publish_attempts"]["Insert"];
type AttemptUpdate =
  Database["public"]["Tables"]["edu_publish_attempts"]["Update"];
type PrepareArgs =
  Database["public"]["Functions"]["prepare_edu_publish_attempt_v1"]["Args"];
type PrepareResult =
  Database["public"]["Functions"]["prepare_edu_publish_attempt_v1"]["Returns"][number];
type BeginArgs =
  Database["public"]["Functions"]["begin_edu_publish_commit_v1"]["Args"];
type BeginResult =
  Database["public"]["Functions"]["begin_edu_publish_commit_v1"]["Returns"][number];
type FailArgs =
  Database["public"]["Functions"]["fail_edu_publish_commit_v1"]["Args"];
type FailResult =
  Database["public"]["Functions"]["fail_edu_publish_commit_v1"]["Returns"][number];
type CompleteArgs =
  Database["public"]["Functions"]["complete_edu_publish_commit_v1"]["Args"];
type CompleteResult =
  Database["public"]["Functions"]["complete_edu_publish_commit_v1"]["Returns"][number];

const ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
const ROOT_ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-000000000002";
const LEASE_OWNER = "00000000-0000-4000-8000-000000000003";
const SLUG = "abc123-123456-p1";
const DIGEST = "0".repeat(64);
const VERIFIED_DIGEST = "f".repeat(64);
const MANIFEST = {
  schemaVersion: 1,
  entryPoint: "index.html",
  files: [],
};
const PREPARED_AT = "2026-12-24T01:00:00.000Z";
const VALIDATION_STARTED_AT = "2026-12-24T01:01:00.000Z";
const PUBLISHED_AT = "2026-12-24T01:02:00.000Z";
const FAILED_AT = "2026-12-24T01:03:00.000Z";
const EXPIRES_AT = "2026-12-24T01:45:00.000Z";
const CREATED_AT = "2026-12-24T00:59:00.000Z";
const UPDATED_AT = "2026-12-24T01:03:00.000Z";
const COMPLETE_PROJECT_ID = "00000000-0000-4000-8000-000000000003";
const COMPLETE_BOARD_ID = "00000000-0000-4000-8000-000000000004";
const COMPLETE_PUBLISHED_AT = "2026-12-24T01:03:00.123456+00:00";
const COMPLETE_EXPIRES_AT = "2026-12-24T01:45:00.123456+00:00";
const COMPLETE_MIGRATION_PATH =
  "supabase/migrations/20260929093150_successor_baseline.sql";

const legacyReservationRow = {
  slug: SLUG,
  attempt_id: null,
  project_id: PROJECT_ID,
  reservation_state: "LEGACY_PROJECT",
  reserved_at: CREATED_AT,
  converted_at: null,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
} satisfies ReservationRow;

const attemptReservedReservationInsert = {
  slug: SLUG,
  attempt_id: ATTEMPT_ID,
  project_id: null,
  reservation_state: "ATTEMPT_RESERVED",
} satisfies ReservationInsert;

const projectPublishedReservationUpdate = {
  reservation_state: "PROJECT_PUBLISHED",
  attempt_id: ATTEMPT_ID,
  project_id: PROJECT_ID,
  converted_at: PUBLISHED_AT,
} satisfies ReservationUpdate;

const tombstonedReservationRow = {
  slug: "abc123-123456-p2",
  attempt_id: null,
  project_id: null,
  reservation_state: "TOMBSTONED",
  reserved_at: CREATED_AT,
  converted_at: null,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
} satisfies ReservationRow;

const preparedAttemptRow = {
  attempt_id: ATTEMPT_ID,
  parent_attempt_id: null,
  root_attempt_id: ROOT_ATTEMPT_ID,
  project_id: null,
  slug: SLUG,
  lesson_id: 1,
  manifest_schema_version: 1,
  declared_manifest_digest: DIGEST,
  declared_manifest: MANIFEST,
  verified_manifest_digest: null,
  state: "PREPARED",
  failure_code: null,
  retry_count: 0,
  commit_count: 0,
  attempt_version: 0,
  lease_owner: null,
  lease_expires_at: null,
  prepared_at: PREPARED_AT,
  validation_started_at: null,
  published_at: null,
  failed_at: null,
  expires_at: EXPIRES_AT,
  capability_issued_at: PREPARED_AT,
  capability_expires_at: EXPIRES_AT,
  capability_kid: "current-v1",
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
} satisfies AttemptRow;

const validatingAttemptUpdate = {
  state: "VALIDATING",
  lease_owner: "worker-a",
  lease_expires_at: "2026-12-24T01:10:00.000Z",
  validation_started_at: VALIDATION_STARTED_AT,
} satisfies AttemptUpdate;

const publishedAttemptRow = {
  ...preparedAttemptRow,
  project_id: PROJECT_ID,
  state: "PUBLISHED",
  verified_manifest_digest: VERIFIED_DIGEST,
  validation_started_at: VALIDATION_STARTED_AT,
  published_at: PUBLISHED_AT,
} satisfies AttemptRow;

const failedRetryableAttemptUpdate = {
  state: "FAILED_RETRYABLE",
  failure_code: "R2_TEMPORARY_FAILURE",
  validation_started_at: VALIDATION_STARTED_AT,
  failed_at: FAILED_AT,
} satisfies AttemptUpdate;

const failedRestartRequiredAttemptUpdate = {
  state: "FAILED_RESTART_REQUIRED",
  failure_code: "R2_DIGEST_MISMATCH",
  validation_started_at: VALIDATION_STARTED_AT,
  failed_at: FAILED_AT,
} satisfies AttemptUpdate;

const abandonedAttemptRow = {
  ...preparedAttemptRow,
  state: "ABANDONED",
  failure_code: "ATTEMPT_EXPIRED",
  validation_started_at: VALIDATION_STARTED_AT,
  failed_at: FAILED_AT,
} satisfies AttemptRow;

const minimalAttemptInsert = {
  attempt_id: ATTEMPT_ID,
  root_attempt_id: ROOT_ATTEMPT_ID,
  slug: SLUG,
  lesson_id: 1,
  declared_manifest_digest: DIGEST,
  declared_manifest: MANIFEST,
  expires_at: EXPIRES_AT,
} satisfies AttemptInsert;

const fullAttemptInsert = {
  attempt_id: ATTEMPT_ID,
  parent_attempt_id: null,
  root_attempt_id: ROOT_ATTEMPT_ID,
  project_id: PROJECT_ID,
  slug: SLUG,
  lesson_id: 4,
  manifest_schema_version: 1,
  declared_manifest_digest: DIGEST,
  declared_manifest: MANIFEST,
  verified_manifest_digest: VERIFIED_DIGEST,
  state: "ABANDONED",
  failure_code: "ATTEMPT_EXPIRED",
  retry_count: 2,
  commit_count: 1,
  attempt_version: 4,
  lease_owner: null,
  lease_expires_at: null,
  prepared_at: PREPARED_AT,
  validation_started_at: VALIDATION_STARTED_AT,
  published_at: null,
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
  capability_issued_at: PREPARED_AT,
  capability_expires_at: EXPIRES_AT,
  capability_kid: "current-v1",
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
} satisfies AttemptInsert;

const prepareArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_lesson_id: 1,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
  p_declared_manifest: MANIFEST,
  p_capability_issued_at: "2026-12-24T01:00:00.000Z",
  p_capability_expires_at: "2026-12-24T01:45:00.000Z",
  p_capability_kid: "current-v1",
} satisfies PrepareArgs;

const createdSuccessRow = {
  outcome: "CREATED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "PREPARED",
  attempt_version: 0,
  expires_at: EXPIRES_AT,
} satisfies PrepareResult;

const alreadyPreparedSuccessRow = {
  outcome: "ALREADY_PREPARED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "PREPARED",
  attempt_version: 0,
  expires_at: EXPIRES_AT,
} satisfies PrepareResult;

const slugConflictRow = {
  outcome: "SLUG_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: null,
} satisfies PrepareResult;

const attemptIdConflictRow = {
  outcome: "ATTEMPT_ID_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: null,
} satisfies PrepareResult;

const stateConflictRow = {
  outcome: "STATE_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: null,
} satisfies PrepareResult;

const invalidInputRow = {
  outcome: "INVALID_INPUT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: null,
} satisfies PrepareResult;

const beginArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
  p_lease_owner: LEASE_OWNER,
} satisfies BeginArgs;

const failArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
  p_lease_owner: LEASE_OWNER,
  p_expected_attempt_version: 5,
  p_failure_code: "R2_TEMPORARY_FAILURE",
} satisfies FailArgs;

const completeArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
  p_verified_manifest_digest: DIGEST,
  p_lease_owner: LEASE_OWNER,
  p_expected_attempt_version: 5,
  p_project_id: COMPLETE_PROJECT_ID,
  p_share_code: "abc123",
  p_lesson_id: 1,
  p_author_name: "학생",
  p_title: "나의 작품",
  p_anon_id: "anon-123",
  p_board_id: COMPLETE_BOARD_ID,
  p_expires_at: COMPLETE_EXPIRES_AT,
  p_files: [
    {
      path: "index.html",
      content_type: "text/html",
      size_bytes: 100,
    },
  ],
  p_preview_url: `https://example.com/edu/view/${SLUG}/?preview=1`,
  p_gallery_preview_url: `https://assets.example.com/v1/${SLUG}/thumb.png`,
  p_public_url: `https://example.com/edu/view/${SLUG}/`,
  p_classroom_url: `https://example.com/edu/view/${SLUG}/?classroom=1`,
  p_request_id: "request-123",
  p_publish_quota_key: "guest:abc123:p1:nick:학생",
} satisfies CompleteArgs;

const completeArgsWithNullables = {
  ...completeArgs,
  p_anon_id: null,
  p_board_id: null,
} satisfies CompleteArgs;

const completePublishedRow = {
  outcome: "PUBLISHED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "PUBLISHED",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  project_id: COMPLETE_PROJECT_ID,
  verified_manifest_digest: DIGEST,
  reservation_state: "PROJECT_PUBLISHED",
  published_at: COMPLETE_PUBLISHED_AT,
  preview_url: `https://example.com/edu/view/${SLUG}/?preview=1`,
  public_url: `https://example.com/edu/view/${SLUG}/`,
  classroom_url: `https://example.com/edu/view/${SLUG}/?classroom=1`,
} satisfies CompleteResult;

const completeAlreadyPublishedRow = {
  ...completePublishedRow,
  outcome: "ALREADY_PUBLISHED",
} satisfies CompleteResult;

type CompleteNegativeOutcome = Exclude<
  (typeof EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES)[number],
  "PUBLISHED" | "ALREADY_PUBLISHED"
>;

const makeCompleteNegativeRow = <T extends CompleteNegativeOutcome>(outcome: T) =>
  ({
    outcome,
    attempt_id: null,
    slug: null,
    state: null,
    attempt_version: null,
    retry_count: null,
    commit_count: null,
    project_id: null,
    verified_manifest_digest: null,
    reservation_state: null,
    published_at: null,
    preview_url: null,
    public_url: null,
    classroom_url: null,
  }) satisfies CompleteResult;

const completeLeaseExpiredRow = makeCompleteNegativeRow("LEASE_EXPIRED");
const completeLeaseMismatchRow = makeCompleteNegativeRow("LEASE_MISMATCH");
const completeVersionMismatchRow = makeCompleteNegativeRow("VERSION_MISMATCH");
const completeBindingMismatchRow = makeCompleteNegativeRow("BINDING_MISMATCH");
const completeReservationMismatchRow = makeCompleteNegativeRow("RESERVATION_MISMATCH");
const completeStateConflictRow = makeCompleteNegativeRow("STATE_CONFLICT");
const completeInvalidInputRow = makeCompleteNegativeRow("INVALID_INPUT");

const failArgsFixtures = [
  failArgs,
  { ...failArgs, p_failure_code: "DB_TEMPORARY_FAILURE" },
  { ...failArgs, p_failure_code: "RPC_TEMPORARY_FAILURE" },
  { ...failArgs, p_failure_code: "INTERNAL_EVALUATION_FAILED" },
  { ...failArgs, p_failure_code: "R2_OBJECT_MISSING" },
  { ...failArgs, p_failure_code: "R2_SIZE_MISMATCH" },
  { ...failArgs, p_failure_code: "R2_DIGEST_MISMATCH" },
  { ...failArgs, p_failure_code: "SLUG_CONFLICT" },
] satisfies FailArgs[];

const failedRetryableRpcRow = {
  outcome: "FAILED_RETRYABLE",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RETRYABLE",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "R2_TEMPORARY_FAILURE",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRetryableDbTemporaryRpcRow = {
  outcome: "FAILED_RETRYABLE",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RETRYABLE",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "DB_TEMPORARY_FAILURE",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRetryableRpcTemporaryRpcRow = {
  outcome: "FAILED_RETRYABLE",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RETRYABLE",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "RPC_TEMPORARY_FAILURE",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRetryableInternalEvaluationRpcRow = {
  outcome: "FAILED_RETRYABLE",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RETRYABLE",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "INTERNAL_EVALUATION_FAILED",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRestartRequiredRpcRow = {
  outcome: "FAILED_RESTART_REQUIRED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RESTART_REQUIRED",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "R2_OBJECT_MISSING",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRestartRequiredSizeMismatchRpcRow = {
  outcome: "FAILED_RESTART_REQUIRED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RESTART_REQUIRED",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "R2_SIZE_MISMATCH",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRestartRequiredDigestMismatchRpcRow = {
  outcome: "FAILED_RESTART_REQUIRED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RESTART_REQUIRED",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "R2_DIGEST_MISMATCH",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failedRestartRequiredSlugConflictRpcRow = {
  outcome: "FAILED_RESTART_REQUIRED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "FAILED_RESTART_REQUIRED",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 2,
  failure_code: "SLUG_CONFLICT",
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
} satisfies FailResult;

const failLeaseExpiredRow = {
  outcome: "LEASE_EXPIRED",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
} satisfies FailResult;

const failLeaseMismatchRow = {
  outcome: "LEASE_MISMATCH",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
} satisfies FailResult;

const failVersionMismatchRow = {
  outcome: "VERSION_MISMATCH",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
} satisfies FailResult;

const failBindingMismatchRow = {
  outcome: "BINDING_MISMATCH",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
} satisfies FailResult;

const failStateConflictRow = {
  outcome: "STATE_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
} satisfies FailResult;

const failInvalidInputRow = {
  outcome: "INVALID_INPUT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
} satisfies FailResult;

const claimedRow = {
  outcome: "CLAIMED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "VALIDATING",
  attempt_version: 1,
  retry_count: 0,
  commit_count: 1,
  lease_expires_at: "2026-12-24T01:05:00.000Z",
  expires_at: EXPIRES_AT,
  project_id: null,
} satisfies BeginResult;

const reclaimedRetryableRow = {
  outcome: "RECLAIMED_RETRYABLE",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "VALIDATING",
  attempt_version: 4,
  retry_count: 2,
  commit_count: 2,
  lease_expires_at: "2026-12-24T01:15:00.000Z",
  expires_at: EXPIRES_AT,
  project_id: null,
} satisfies BeginResult;

const takenOverStaleLeaseRow = {
  outcome: "TAKEN_OVER_STALE_LEASE",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "VALIDATING",
  attempt_version: 6,
  retry_count: 1,
  commit_count: 3,
  lease_expires_at: "2026-12-24T01:20:00.000Z",
  expires_at: EXPIRES_AT,
  project_id: null,
} satisfies BeginResult;

const alreadyPublishedRow = {
  outcome: "ALREADY_PUBLISHED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "PUBLISHED",
  attempt_version: 7,
  retry_count: 1,
  commit_count: 3,
  lease_expires_at: null,
  expires_at: EXPIRES_AT,
  project_id: PROJECT_ID,
} satisfies BeginResult;

const leaseActiveRow = {
  outcome: "LEASE_ACTIVE",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
} satisfies BeginResult;

const attemptExpiredRow = {
  outcome: "ATTEMPT_EXPIRED",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
} satisfies BeginResult;

const bindingMismatchRow = {
  outcome: "BINDING_MISMATCH",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
} satisfies BeginResult;

const beginStateConflictRow = {
  outcome: "STATE_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
} satisfies BeginResult;

const retryExhaustedRow = {
  outcome: "RETRY_EXHAUSTED",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
} satisfies BeginResult;

const beginInvalidInputRow = {
  outcome: "INVALID_INPUT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
} satisfies BeginResult;

// @ts-expect-error request-only capability failure codes are not stored attempt failures.
const invalidCapabilityInvalidFailure = { failure_code: "CAPABILITY_INVALID" } satisfies AttemptUpdate;
// @ts-expect-error request-only capability failure codes are not stored attempt failures.
const invalidCapabilityExpiredFailure = { failure_code: "CAPABILITY_EXPIRED" } satisfies AttemptUpdate;
// @ts-expect-error request-only capability failure codes are not stored attempt failures.
const invalidCapabilityMismatchFailure = { failure_code: "CAPABILITY_MISMATCH" } satisfies AttemptUpdate;
// @ts-expect-error request-only attempt state failure codes are not stored attempt failures.
const invalidAttemptStateConflictFailure = { failure_code: "ATTEMPT_STATE_CONFLICT" } satisfies AttemptUpdate;
// @ts-expect-error request-only lease failure codes are not stored attempt failures.
const invalidAttemptLeaseActiveFailure = { failure_code: "ATTEMPT_LEASE_ACTIVE" } satisfies AttemptUpdate;
// @ts-expect-error unknown failure codes are not stored attempt failures.
const invalidUnknownFailure = { failure_code: "UNKNOWN" } satisfies AttemptUpdate;

// @ts-expect-error PUBLISHING is not a persisted attempt state.
const invalidPublishingState = { state: "PUBLISHING" } satisfies AttemptUpdate;
// @ts-expect-error UPLOADING is not a persisted attempt state.
const invalidUploadingState = { state: "UPLOADING" } satisfies AttemptUpdate;
// @ts-expect-error DRAFT is not a persisted attempt state.
const invalidDraftState = { state: "DRAFT" } satisfies AttemptUpdate;
// @ts-expect-error FAILED is not a persisted attempt state.
const invalidFailedState = { state: "FAILED" } satisfies AttemptUpdate;

const invalidLessonZeroInsert = {
  ...minimalAttemptInsert,
  // @ts-expect-error lesson ids are restricted to 1 through 4.
  lesson_id: 0,
} satisfies AttemptInsert;
const invalidLessonFiveInsert = {
  ...minimalAttemptInsert,
  // @ts-expect-error lesson ids are restricted to 1 through 4.
  lesson_id: 5,
} satisfies AttemptInsert;
const invalidManifestSchemaTwoInsert = {
  ...minimalAttemptInsert,
  // @ts-expect-error only manifest schema version 1 is persisted.
  manifest_schema_version: 2,
} satisfies AttemptInsert;
const invalidLessonZeroRpc = {
  ...prepareArgs,
  // @ts-expect-error lesson ids are restricted to 1 through 4.
  p_lesson_id: 0,
} satisfies PrepareArgs;
const invalidLessonFiveRpc = {
  ...prepareArgs,
  // @ts-expect-error lesson ids are restricted to 1 through 4.
  p_lesson_id: 5,
} satisfies PrepareArgs;
const invalidManifestSchemaTwoRpc = {
  ...prepareArgs,
  // @ts-expect-error only manifest schema version 1 is accepted by the RPC.
  p_manifest_schema_version: 2,
} satisfies PrepareArgs;

const invalidCreatedNullIdentity = {
  outcome: "CREATED",
  attempt_id: null,
  slug: SLUG,
  state: "PREPARED",
  attempt_version: 0,
  expires_at: EXPIRES_AT,
  // @ts-expect-error CREATED must carry its attempt identity.
} satisfies PrepareResult;
const invalidAlreadyPreparedNullState = {
  outcome: "ALREADY_PREPARED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: null,
  attempt_version: 0,
  expires_at: EXPIRES_AT,
  // @ts-expect-error ALREADY_PREPARED must carry PREPARED state.
} satisfies PrepareResult;
const invalidSlugConflictIdentity = {
  outcome: "SLUG_CONFLICT",
  attempt_id: null,
  slug: SLUG,
  state: null,
  attempt_version: null,
  expires_at: null,
  // @ts-expect-error conflict rows must hide the slug identity.
} satisfies PrepareResult;
const invalidAttemptIdConflictVersion = {
  outcome: "ATTEMPT_ID_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: 0,
  expires_at: null,
  // @ts-expect-error conflict rows must hide the attempt version.
} satisfies PrepareResult;
const invalidStateConflictExpiry = {
  outcome: "STATE_CONFLICT",
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: EXPIRES_AT,
  // @ts-expect-error conflict rows must hide the expiry.
} satisfies PrepareResult;
const invalidInputIdentity = {
  outcome: "INVALID_INPUT",
  attempt_id: ATTEMPT_ID,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: null,
  // @ts-expect-error invalid input rows must hide the attempt identity.
} satisfies PrepareResult;

const invalidBeginManifestSchemaTwo = {
  ...beginArgs,
  // @ts-expect-error only manifest schema version 1 is accepted by the begin RPC.
  p_manifest_schema_version: 2,
} satisfies BeginArgs;

// @ts-expect-error p_lease_owner is required by the begin RPC.
const invalidMissingLeaseOwner: BeginArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
};

const invalidNullLeaseOwner = {
  ...beginArgs,
  // @ts-expect-error p_lease_owner must be a string UUID.
  p_lease_owner: null,
} satisfies BeginArgs;

const invalidExtraBeginArgument = {
  ...beginArgs,
  // @ts-expect-error p_request_id is not part of the begin RPC signature.
  p_request_id: "request-id",
} satisfies BeginArgs;

const invalidCamelCaseBeginArgs = {
  // @ts-expect-error SQL RPC arguments use exact snake_case names.
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  leaseOwner: LEASE_OWNER,
} satisfies BeginArgs;

const invalidFailManifestSchemaTwo = {
  ...failArgs,
  // @ts-expect-error only manifest schema version 1 is accepted by the fail RPC.
  p_manifest_schema_version: 2,
} satisfies FailArgs;

// @ts-expect-error p_expected_attempt_version is required by the fail RPC.
const invalidMissingFailExpectedVersion: FailArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
  p_lease_owner: LEASE_OWNER,
  p_failure_code: "R2_TEMPORARY_FAILURE",
};

// @ts-expect-error p_failure_code is required by the fail RPC.
const invalidMissingFailCode: FailArgs = {
  p_attempt_id: ATTEMPT_ID,
  p_slug: SLUG,
  p_manifest_schema_version: 1,
  p_declared_manifest_digest: DIGEST,
  p_lease_owner: LEASE_OWNER,
  p_expected_attempt_version: 5,
};

const invalidNullFailExpectedVersion = {
  ...failArgs,
  // @ts-expect-error p_expected_attempt_version must be a number.
  p_expected_attempt_version: null,
} satisfies FailArgs;
const invalidStringFailExpectedVersion = {
  ...failArgs,
  // @ts-expect-error p_expected_attempt_version must be a number.
  p_expected_attempt_version: "5",
} satisfies FailArgs;

const invalidFailAttemptExpiredCode = {
  ...failArgs,
  // @ts-expect-error ATTEMPT_EXPIRED is a stored-attempt code, not fail RPC input.
  p_failure_code: "ATTEMPT_EXPIRED",
} satisfies FailArgs;
const invalidFailCapabilityInvalidCode = {
  ...failArgs,
  // @ts-expect-error request-only capability failure codes are not fail RPC input.
  p_failure_code: "CAPABILITY_INVALID",
} satisfies FailArgs;
const invalidFailCapabilityExpiredCode = {
  ...failArgs,
  // @ts-expect-error request-only capability failure codes are not fail RPC input.
  p_failure_code: "CAPABILITY_EXPIRED",
} satisfies FailArgs;
const invalidFailCapabilityMismatchCode = {
  ...failArgs,
  // @ts-expect-error request-only capability failure codes are not fail RPC input.
  p_failure_code: "CAPABILITY_MISMATCH",
} satisfies FailArgs;
const invalidFailAttemptStateConflictCode = {
  ...failArgs,
  // @ts-expect-error request-only attempt-state failure codes are not fail RPC input.
  p_failure_code: "ATTEMPT_STATE_CONFLICT",
} satisfies FailArgs;
const invalidFailAttemptLeaseActiveCode = {
  ...failArgs,
  // @ts-expect-error request-only lease failure codes are not fail RPC input.
  p_failure_code: "ATTEMPT_LEASE_ACTIVE",
} satisfies FailArgs;
const invalidFailUnknownCode = {
  ...failArgs,
  // @ts-expect-error unknown failure codes are not fail RPC input.
  p_failure_code: "UNKNOWN",
} satisfies FailArgs;

const invalidExtraFailArgument = {
  ...failArgs,
  // @ts-expect-error p_project_id is not part of the fail RPC signature.
  p_project_id: PROJECT_ID,
} satisfies FailArgs;

const invalidCamelCaseFailArgs = {
  // @ts-expect-error SQL RPC arguments use exact snake_case names.
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  leaseOwner: LEASE_OWNER,
  expectedAttemptVersion: 5,
  failureCode: "R2_TEMPORARY_FAILURE",
} satisfies FailArgs;

const invalidRetryableNullAttemptId = {
  ...failedRetryableRpcRow,
  // @ts-expect-error retryable success rows must carry attempt identity.
  attempt_id: null,
} satisfies FailResult;
const invalidRetryableRestartState = {
  ...failedRetryableRpcRow,
  // @ts-expect-error retryable success rows must return FAILED_RETRYABLE state.
  state: "FAILED_RESTART_REQUIRED",
} satisfies FailResult;
const invalidRetryableDigestMismatchCode = {
  ...failedRetryableRpcRow,
  // @ts-expect-error restart-required failure codes are not retryable.
  failure_code: "R2_DIGEST_MISMATCH",
} satisfies FailResult;
const invalidRetryableAttemptExpiredCode = {
  ...failedRetryableRpcRow,
  // @ts-expect-error ATTEMPT_EXPIRED is not a fail success code.
  failure_code: "ATTEMPT_EXPIRED",
} satisfies FailResult;
const invalidRetryableNullFailedAt = {
  ...failedRetryableRpcRow,
  // @ts-expect-error retryable success rows must carry failed_at.
  failed_at: null,
} satisfies FailResult;
const invalidRetryableNullRetryCount = {
  ...failedRetryableRpcRow,
  // @ts-expect-error retryable success rows must carry retry_count.
  retry_count: null,
} satisfies FailResult;

const invalidRestartRetryableState = {
  ...failedRestartRequiredRpcRow,
  // @ts-expect-error restart-required success rows must return FAILED_RESTART_REQUIRED state.
  state: "FAILED_RETRYABLE",
} satisfies FailResult;
const invalidRestartTemporaryCode = {
  ...failedRestartRequiredRpcRow,
  // @ts-expect-error retryable failure codes are not restart-required.
  failure_code: "R2_TEMPORARY_FAILURE",
} satisfies FailResult;
const invalidRestartAttemptExpiredCode = {
  ...failedRestartRequiredRpcRow,
  // @ts-expect-error ATTEMPT_EXPIRED is not a fail success code.
  failure_code: "ATTEMPT_EXPIRED",
} satisfies FailResult;
const invalidRestartNullAttemptVersion = {
  ...failedRestartRequiredRpcRow,
  // @ts-expect-error restart-required success rows must carry attempt_version.
  attempt_version: null,
} satisfies FailResult;
const invalidRestartNullExpiresAt = {
  ...failedRestartRequiredRpcRow,
  // @ts-expect-error restart-required success rows must carry expires_at.
  expires_at: null,
} satisfies FailResult;

const invalidFailLeaseExpiredTimestamp = {
  ...failLeaseExpiredRow,
  // @ts-expect-error negative outcomes must hide failed_at.
  failed_at: FAILED_AT,
} satisfies FailResult;
const invalidFailLeaseMismatchIdentity = {
  ...failLeaseMismatchRow,
  // @ts-expect-error negative outcomes must hide attempt identity.
  attempt_id: ATTEMPT_ID,
} satisfies FailResult;
const invalidFailVersionMismatchVersion = {
  ...failVersionMismatchRow,
  // @ts-expect-error negative outcomes must hide attempt version.
  attempt_version: 6,
} satisfies FailResult;
const invalidFailBindingMismatchSlug = {
  ...failBindingMismatchRow,
  // @ts-expect-error negative outcomes must hide slug identity.
  slug: SLUG,
} satisfies FailResult;
const invalidFailStateConflictState = {
  ...failStateConflictRow,
  // @ts-expect-error negative outcomes must hide stored state.
  state: "VALIDATING",
} satisfies FailResult;
const invalidFailInputCode = {
  ...failInvalidInputRow,
  // @ts-expect-error invalid input rows must hide the requested failure code.
  failure_code: "R2_TEMPORARY_FAILURE",
} satisfies FailResult;

const invalidUnknownFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error UNKNOWN is not part of the fail contract.
  outcome: "UNKNOWN",
} satisfies FailResult;
const invalidErrorFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error ERROR is not part of the fail contract.
  outcome: "ERROR",
} satisfies FailResult;
const invalidFailedFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error FAILED is not part of the fail contract.
  outcome: "FAILED",
} satisfies FailResult;
const invalidAlreadyFailedFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error ALREADY_FAILED is not part of the fail contract.
  outcome: "ALREADY_FAILED",
} satisfies FailResult;
const invalidAlreadyPublishedFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error ALREADY_PUBLISHED is not part of the fail contract.
  outcome: "ALREADY_PUBLISHED",
} satisfies FailResult;
const invalidNotFoundFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error NOT_FOUND is not part of the fail contract.
  outcome: "NOT_FOUND",
} satisfies FailResult;
const invalidRetryFailOutcome = {
  ...failedRetryableRpcRow,
  // @ts-expect-error RETRY is not part of the fail contract.
  outcome: "RETRY",
} satisfies FailResult;

const invalidClaimNullAttemptId = {
  ...claimedRow,
  // @ts-expect-error claim outcomes must carry the attempt identity.
  attempt_id: null,
} satisfies BeginResult;
const invalidClaimPreparedState = {
  ...claimedRow,
  // @ts-expect-error claim outcomes must return VALIDATING state.
  state: "PREPARED",
} satisfies BeginResult;
const invalidClaimNullLeaseExpiry = {
  ...claimedRow,
  // @ts-expect-error claim outcomes must carry a lease expiry.
  lease_expires_at: null,
} satisfies BeginResult;
const invalidClaimProjectIdentity = {
  ...claimedRow,
  // @ts-expect-error claim outcomes must not expose a project identity.
  project_id: PROJECT_ID,
} satisfies BeginResult;
const invalidReclaimedNullRetryCount = {
  ...reclaimedRetryableRow,
  // @ts-expect-error reclaimed retry rows must carry retry_count.
  retry_count: null,
} satisfies BeginResult;
const invalidStaleNullExpiry = {
  ...takenOverStaleLeaseRow,
  // @ts-expect-error stale takeover rows must carry expires_at.
  expires_at: null,
} satisfies BeginResult;

const invalidPublishedNullProject = {
  ...alreadyPublishedRow,
  // @ts-expect-error published replay rows must carry the project identity.
  project_id: null,
} satisfies BeginResult;
const invalidPublishedValidatingState = {
  ...alreadyPublishedRow,
  // @ts-expect-error published replay rows must return PUBLISHED state.
  state: "VALIDATING",
} satisfies BeginResult;
const invalidPublishedLeaseExpiry = {
  ...alreadyPublishedRow,
  // @ts-expect-error published replay rows must hide lease expiry.
  lease_expires_at: EXPIRES_AT,
} satisfies BeginResult;
const invalidPublishedNullAttemptId = {
  ...alreadyPublishedRow,
  // @ts-expect-error published replay rows must carry the attempt identity.
  attempt_id: null,
} satisfies BeginResult;

const invalidLeaseActiveLeaseExpiry = {
  ...leaseActiveRow,
  // @ts-expect-error negative outcomes must hide lease expiry.
  lease_expires_at: EXPIRES_AT,
} satisfies BeginResult;
const invalidAttemptExpiredState = {
  ...attemptExpiredRow,
  // @ts-expect-error ATTEMPT_EXPIRED return rows must hide the mutated state.
  state: "ABANDONED",
} satisfies BeginResult;
const invalidBindingMismatchAttemptId = {
  ...bindingMismatchRow,
  // @ts-expect-error binding mismatch rows must hide attempt identity.
  attempt_id: ATTEMPT_ID,
} satisfies BeginResult;
const invalidBeginStateConflictSlug = {
  ...beginStateConflictRow,
  // @ts-expect-error state conflict rows must hide slug identity.
  slug: SLUG,
} satisfies BeginResult;
const invalidRetryExhaustedRetryCount = {
  ...retryExhaustedRow,
  // @ts-expect-error retry exhausted rows must hide retry_count.
  retry_count: 3,
} satisfies BeginResult;
const invalidBeginInputProjectId = {
  ...beginInvalidInputRow,
  // @ts-expect-error invalid input rows must hide project identity.
  project_id: PROJECT_ID,
} satisfies BeginResult;

const invalidUnknownBeginOutcome = {
  ...claimedRow,
  // @ts-expect-error unknown outcomes are not part of the begin contract.
  outcome: "UNKNOWN",
} satisfies BeginResult;
const invalidErrorBeginOutcome = {
  ...claimedRow,
  // @ts-expect-error ERROR is not part of the begin contract.
  outcome: "ERROR",
} satisfies BeginResult;
const invalidFailedBeginOutcome = {
  ...claimedRow,
  // @ts-expect-error FAILED is not part of the begin contract.
  outcome: "FAILED",
} satisfies BeginResult;
const invalidNotFoundBeginOutcome = {
  ...claimedRow,
  // @ts-expect-error NOT_FOUND is not part of the begin contract.
  outcome: "NOT_FOUND",
} satisfies BeginResult;
const invalidRetryBeginOutcome = {
  ...claimedRow,
  // @ts-expect-error RETRY is not part of the begin contract.
  outcome: "RETRY",
} satisfies BeginResult;

const invalidCompleteManifestSchemaTwo = {
  ...completeArgs,
  // @ts-expect-error only manifest schema version 1 is accepted by the complete RPC.
  p_manifest_schema_version: 2,
} satisfies CompleteArgs;
const invalidCompleteLessonZero = {
  ...completeArgs,
  // @ts-expect-error lesson ids are restricted to 1 through 4.
  p_lesson_id: 0,
} satisfies CompleteArgs;
const invalidCompleteLessonFive = {
  ...completeArgs,
  // @ts-expect-error lesson ids are restricted to 1 through 4.
  p_lesson_id: 5,
} satisfies CompleteArgs;
const invalidCompleteLessonString = {
  ...completeArgs,
  // @ts-expect-error lesson ids must be numeric literals.
  p_lesson_id: "1",
} satisfies CompleteArgs;

const {
  p_verified_manifest_digest: omittedCompleteVerifiedDigest,
  ...completeArgsWithoutVerifiedDigest
} = completeArgs;
void omittedCompleteVerifiedDigest;
// @ts-expect-error p_verified_manifest_digest is required by the complete RPC.
const invalidMissingCompleteVerifiedDigest: CompleteArgs =
  completeArgsWithoutVerifiedDigest;

const {
  p_expected_attempt_version: omittedCompleteExpectedVersion,
  ...completeArgsWithoutExpectedVersion
} = completeArgs;
void omittedCompleteExpectedVersion;
// @ts-expect-error p_expected_attempt_version is required by the complete RPC.
const invalidMissingCompleteExpectedVersion: CompleteArgs =
  completeArgsWithoutExpectedVersion;

const {
  p_project_id: omittedCompleteProjectId,
  ...completeArgsWithoutProjectId
} = completeArgs;
void omittedCompleteProjectId;
// @ts-expect-error p_project_id is required by the complete RPC.
const invalidMissingCompleteProjectId: CompleteArgs = completeArgsWithoutProjectId;

const {
  p_publish_quota_key: omittedCompleteQuotaKey,
  ...completeArgsWithoutQuotaKey
} = completeArgs;
void omittedCompleteQuotaKey;
// @ts-expect-error p_publish_quota_key is required by the complete RPC.
const invalidMissingCompleteQuotaKey: CompleteArgs = completeArgsWithoutQuotaKey;

const {
  p_gallery_preview_url: omittedCompleteGalleryUrl,
  ...completeArgsWithoutGalleryUrl
} = completeArgs;
void omittedCompleteGalleryUrl;
// @ts-expect-error p_gallery_preview_url is required by the complete RPC.
const invalidMissingCompleteGalleryUrl: CompleteArgs =
  completeArgsWithoutGalleryUrl;

const {
  p_files: omittedCompleteFiles,
  ...completeArgsWithoutFiles
} = completeArgs;
void omittedCompleteFiles;
// @ts-expect-error p_files is required by the complete RPC.
const invalidMissingCompleteFiles: CompleteArgs = completeArgsWithoutFiles;

const {
  p_anon_id: omittedCompleteAnonId,
  ...completeArgsWithoutAnonId
} = completeArgs;
void omittedCompleteAnonId;
// @ts-expect-error p_anon_id is required even though its value may be null.
const invalidMissingCompleteAnonId: CompleteArgs = completeArgsWithoutAnonId;

const {
  p_board_id: omittedCompleteBoardId,
  ...completeArgsWithoutBoardId
} = completeArgs;
void omittedCompleteBoardId;
// @ts-expect-error p_board_id is required even though its value may be null.
const invalidMissingCompleteBoardId: CompleteArgs = completeArgsWithoutBoardId;

const invalidNullCompleteAttemptId = {
  ...completeArgs,
  // @ts-expect-error p_attempt_id cannot be null.
  p_attempt_id: null,
} satisfies CompleteArgs;
const invalidNullCompleteProjectId = {
  ...completeArgs,
  // @ts-expect-error p_project_id cannot be null.
  p_project_id: null,
} satisfies CompleteArgs;
const invalidNullCompleteShareCode = {
  ...completeArgs,
  // @ts-expect-error p_share_code cannot be null.
  p_share_code: null,
} satisfies CompleteArgs;
const invalidNullCompleteFiles = {
  ...completeArgs,
  // @ts-expect-error p_files cannot be null.
  p_files: null,
} satisfies CompleteArgs;
const invalidNullCompleteQuotaKey = {
  ...completeArgs,
  // @ts-expect-error p_publish_quota_key cannot be null.
  p_publish_quota_key: null,
} satisfies CompleteArgs;

const invalidCompleteMissingContentTypeFile = {
  ...completeArgs,
  p_files: [
    {
      path: "index.html",
      // @ts-expect-error content_type is required for SQL JSONB files.
      size_bytes: 100,
    },
  ],
} satisfies CompleteArgs;
const invalidCompleteStringSizeFile = {
  ...completeArgs,
  p_files: [
    {
      path: "index.html",
      content_type: "text/html",
      // @ts-expect-error size_bytes must be a number.
      size_bytes: "100",
    },
  ],
} satisfies CompleteArgs;
const invalidCompletePrivateFileKey = {
  ...completeArgs,
  p_files: [
    {
      path: "index.html",
      content_type: "text/html",
      size_bytes: 100,
      // @ts-expect-error private file metadata is not part of the RPC JSONB shape.
      private_key: "secret",
    },
  ],
} satisfies CompleteArgs;
const invalidCompleteCamelCaseFileKey = {
  ...completeArgs,
  p_files: [
    {
      path: "index.html",
      content_type: "text/html",
      size_bytes: 100,
      // @ts-expect-error camelCase file keys are not part of the SQL boundary shape.
      contentType: "text/html",
    },
  ],
} satisfies CompleteArgs;
const invalidCompleteCamelCaseSizeKey = {
  ...completeArgs,
  p_files: [
    {
      path: "index.html",
      content_type: "text/html",
      size_bytes: 100,
      // @ts-expect-error camelCase file keys are not part of the SQL boundary shape.
      sizeBytes: 100,
    },
  ],
} satisfies CompleteArgs;

const invalidExtraCompleteArgument = {
  ...completeArgs,
  // @ts-expect-error p_capability is not part of the complete RPC signature.
  p_capability: "capability",
} satisfies CompleteArgs;

const invalidCamelCaseCompleteArgs = {
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  verifiedManifestDigest: DIGEST,
  leaseOwner: LEASE_OWNER,
  expectedAttemptVersion: 5,
  projectId: COMPLETE_PROJECT_ID,
  shareCode: "abc123",
  lessonId: 1,
  authorName: "학생",
} as const;
// @ts-expect-error complete RPC arguments use exact snake_case names and all 22 fields.
const invalidCamelCaseCompleteArgsAssignment: CompleteArgs = invalidCamelCaseCompleteArgs;

const invalidCompletePublishedNullAttemptId = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must carry attempt identity.
  attempt_id: null,
} satisfies CompleteResult;
const invalidCompletePublishedState = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must return PUBLISHED state.
  state: "VALIDATING",
} satisfies CompleteResult;
const invalidCompletePublishedNullProject = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must carry project identity.
  project_id: null,
} satisfies CompleteResult;
const invalidCompletePublishedNullDigest = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must carry the verified digest.
  verified_manifest_digest: null,
} satisfies CompleteResult;
const invalidCompletePublishedReservation = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must return PROJECT_PUBLISHED reservation state.
  reservation_state: "ATTEMPT_RESERVED",
} satisfies CompleteResult;
const invalidCompletePublishedNullTimestamp = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must carry published_at.
  published_at: null,
} satisfies CompleteResult;
const invalidCompletePublishedNullPreview = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED rows must carry preview_url.
  preview_url: null,
} satisfies CompleteResult;

const invalidCompleteReplayNullProject = {
  ...completeAlreadyPublishedRow,
  // @ts-expect-error ALREADY_PUBLISHED rows must carry project identity.
  project_id: null,
} satisfies CompleteResult;
const invalidCompleteReplayNullState = {
  ...completeAlreadyPublishedRow,
  // @ts-expect-error ALREADY_PUBLISHED rows must return PUBLISHED state.
  state: null,
} satisfies CompleteResult;
const invalidCompleteReplayNullReservation = {
  ...completeAlreadyPublishedRow,
  // @ts-expect-error ALREADY_PUBLISHED rows must carry reservation state.
  reservation_state: null,
} satisfies CompleteResult;
const invalidCompleteReplayNullPublicUrl = {
  ...completeAlreadyPublishedRow,
  // @ts-expect-error ALREADY_PUBLISHED rows must carry public_url.
  public_url: null,
} satisfies CompleteResult;

const invalidCompleteLeaseExpiredTimestamp = {
  ...completeLeaseExpiredRow,
  // @ts-expect-error negative outcomes must hide published_at.
  published_at: COMPLETE_PUBLISHED_AT,
} satisfies CompleteResult;
const invalidCompleteLeaseMismatchIdentity = {
  ...completeLeaseMismatchRow,
  // @ts-expect-error negative outcomes must hide attempt identity.
  attempt_id: ATTEMPT_ID,
} satisfies CompleteResult;
const invalidCompleteVersionMismatchVersion = {
  ...completeVersionMismatchRow,
  // @ts-expect-error negative outcomes must hide attempt version.
  attempt_version: 6,
} satisfies CompleteResult;
const invalidCompleteBindingMismatchSlug = {
  ...completeBindingMismatchRow,
  // @ts-expect-error negative outcomes must hide slug identity.
  slug: SLUG,
} satisfies CompleteResult;
const invalidCompleteReservationMismatchProject = {
  ...completeReservationMismatchRow,
  // @ts-expect-error negative outcomes must hide project identity.
  project_id: COMPLETE_PROJECT_ID,
} satisfies CompleteResult;
const invalidCompleteStateConflictState = {
  ...completeStateConflictRow,
  // @ts-expect-error negative outcomes must hide stored state.
  state: "VALIDATING",
} satisfies CompleteResult;
const invalidCompleteInvalidInputDigest = {
  ...completeInvalidInputRow,
  // @ts-expect-error negative outcomes must hide the verified digest.
  verified_manifest_digest: DIGEST,
} satisfies CompleteResult;

const invalidCompletePublishedNullState = {
  ...completePublishedRow,
  // @ts-expect-error PUBLISHED is always paired with PUBLISHED state.
  state: null,
} satisfies CompleteResult;
const invalidCompleteReplayNullReservationState = {
  ...completeAlreadyPublishedRow,
  // @ts-expect-error ALREADY_PUBLISHED is always paired with PROJECT_PUBLISHED.
  reservation_state: null,
} satisfies CompleteResult;
const invalidCompleteNegativePublishedState = {
  ...completeLeaseExpiredRow,
  // @ts-expect-error negative outcomes cannot expose PUBLISHED state.
  state: "PUBLISHED",
} satisfies CompleteResult;
const invalidCompleteNegativeProjectState = {
  ...completeStateConflictRow,
  // @ts-expect-error STATE_CONFLICT rows must hide project identity.
  project_id: COMPLETE_PROJECT_ID,
} satisfies CompleteResult;

const invalidCompleteCreatedOutcome = {
  ...completePublishedRow,
  // @ts-expect-error CREATED is not part of the complete contract.
  outcome: "CREATED",
} satisfies CompleteResult;
const invalidCompleteSuccessOutcome = {
  ...completePublishedRow,
  // @ts-expect-error SUCCESS is not part of the complete contract.
  outcome: "SUCCESS",
} satisfies CompleteResult;
const invalidCompleteProjectConflictOutcome = {
  ...completePublishedRow,
  // @ts-expect-error PROJECT_CONFLICT is not part of the complete contract.
  outcome: "PROJECT_CONFLICT",
} satisfies CompleteResult;
const invalidCompleteSlugConflictOutcome = {
  ...completePublishedRow,
  // @ts-expect-error SLUG_CONFLICT is not part of the complete contract.
  outcome: "SLUG_CONFLICT",
} satisfies CompleteResult;
const invalidCompleteFailedOutcome = {
  ...completePublishedRow,
  // @ts-expect-error FAILED is not part of the complete contract.
  outcome: "FAILED",
} satisfies CompleteResult;
const invalidCompleteErrorOutcome = {
  ...completePublishedRow,
  // @ts-expect-error ERROR is not part of the complete contract.
  outcome: "ERROR",
} satisfies CompleteResult;
const invalidCompleteUnknownOutcome = {
  ...completePublishedRow,
  // @ts-expect-error UNKNOWN is not part of the complete contract.
  outcome: "UNKNOWN",
} satisfies CompleteResult;
const invalidCompleteRetryOutcome = {
  ...completePublishedRow,
  // @ts-expect-error RETRY is not part of the complete contract.
  outcome: "RETRY",
} satisfies CompleteResult;
const invalidCompleteNotFoundOutcome = {
  ...completePublishedRow,
  // @ts-expect-error NOT_FOUND is not part of the complete contract.
  outcome: "NOT_FOUND",
} satisfies CompleteResult;
const invalidCompleteLowercasePublishedOutcome = {
  ...completePublishedRow,
  // @ts-expect-error lowercase published is not part of the complete contract.
  outcome: "published",
} satisfies CompleteResult;
const invalidCompleteLowercaseReplayOutcome = {
  ...completePublishedRow,
  // @ts-expect-error lowercase replay is not part of the complete contract.
  outcome: "already_published",
} satisfies CompleteResult;

test("reservation type fixtures preserve the four persisted states", () => {
  assert.deepEqual(
    [
      legacyReservationRow.reservation_state,
      attemptReservedReservationInsert.reservation_state,
      projectPublishedReservationUpdate.reservation_state,
      tombstonedReservationRow.reservation_state,
    ],
    ["LEGACY_PROJECT", "ATTEMPT_RESERVED", "PROJECT_PUBLISHED", "TOMBSTONED"],
  );
  assert.equal(legacyReservationRow.project_id, PROJECT_ID);
  assert.equal(attemptReservedReservationInsert.attempt_id, ATTEMPT_ID);
  assert.equal(projectPublishedReservationUpdate.converted_at, PUBLISHED_AT);
  assert.equal(tombstonedReservationRow.attempt_id, null);
  assert.equal(tombstonedReservationRow.project_id, null);
});

test("attempt type fixtures preserve six states and stored failures", () => {
  assert.deepEqual(
    [
      preparedAttemptRow.state,
      validatingAttemptUpdate.state,
      publishedAttemptRow.state,
      failedRetryableAttemptUpdate.state,
      failedRestartRequiredAttemptUpdate.state,
      abandonedAttemptRow.state,
    ],
    [
      "PREPARED",
      "VALIDATING",
      "PUBLISHED",
      "FAILED_RETRYABLE",
      "FAILED_RESTART_REQUIRED",
      "ABANDONED",
    ],
  );
  assert.deepEqual(
    [failedRetryableAttemptUpdate.failure_code, failedRestartRequiredAttemptUpdate.failure_code, abandonedAttemptRow.failure_code],
    ["R2_TEMPORARY_FAILURE", "R2_DIGEST_MISMATCH", "ATTEMPT_EXPIRED"],
  );
  assert.equal(minimalAttemptInsert.expires_at, EXPIRES_AT);
  assert.equal(fullAttemptInsert.manifest_schema_version, 1);
});

test("prepare args preserve the exact nine SQL argument names", () => {
  assert.equal(Object.keys(prepareArgs).length, 9);
  assert.deepEqual(Object.keys(prepareArgs).sort(), [
    "p_attempt_id",
    "p_capability_expires_at",
    "p_capability_issued_at",
    "p_capability_kid",
    "p_declared_manifest",
    "p_declared_manifest_digest",
    "p_lesson_id",
    "p_manifest_schema_version",
    "p_slug",
  ]);
});

test("success RPC rows carry their own identity", () => {
  for (const row of [createdSuccessRow, alreadyPreparedSuccessRow]) {
    assert.equal(typeof row.attempt_id, "string");
    assert.equal(typeof row.slug, "string");
    assert.equal(row.state, "PREPARED");
    assert.equal(typeof row.attempt_version, "number");
    assert.equal(typeof row.expires_at, "string");
  }
});

test("conflict RPC rows hide every identity field", () => {
  for (const row of [slugConflictRow, attemptIdConflictRow, stateConflictRow, invalidInputRow]) {
    assert.equal(row.attempt_id, null);
    assert.equal(row.slug, null);
    assert.equal(row.state, null);
    assert.equal(row.attempt_version, null);
    assert.equal(row.expires_at, null);
  }
});

test("fail args preserve the exact seven SQL argument names", () => {
  assert.equal(Object.keys(failArgs).length, 7);
  assert.deepEqual(Object.keys(failArgs).sort(), [
    "p_attempt_id",
    "p_declared_manifest_digest",
    "p_expected_attempt_version",
    "p_failure_code",
    "p_lease_owner",
    "p_manifest_schema_version",
    "p_slug",
  ]);
  assert.equal(failArgs.p_manifest_schema_version, 1);
  assert.equal(failArgs.p_lease_owner, LEASE_OWNER);
  assert.equal(failArgs.p_expected_attempt_version, 5);
  assert.equal(failArgs.p_failure_code, "R2_TEMPORARY_FAILURE");
});

test("fail args preserve every allowed failure-code literal", () => {
  assert.deepEqual(
    failArgsFixtures.map((args) => args.p_failure_code),
    [
      "R2_TEMPORARY_FAILURE",
      "DB_TEMPORARY_FAILURE",
      "RPC_TEMPORARY_FAILURE",
      "INTERNAL_EVALUATION_FAILED",
      "R2_OBJECT_MISSING",
      "R2_SIZE_MISMATCH",
      "R2_DIGEST_MISMATCH",
      "SLUG_CONFLICT",
    ],
  );
});

test("fail success rows preserve exact retryable and restart-required code families", () => {
  const retryableRows = [
    failedRetryableRpcRow,
    failedRetryableDbTemporaryRpcRow,
    failedRetryableRpcTemporaryRpcRow,
    failedRetryableInternalEvaluationRpcRow,
  ];
  const restartRequiredRows = [
    failedRestartRequiredRpcRow,
    failedRestartRequiredSizeMismatchRpcRow,
    failedRestartRequiredDigestMismatchRpcRow,
    failedRestartRequiredSlugConflictRpcRow,
  ];

  assert.deepEqual(
    retryableRows.map((row) => row.outcome),
    ["FAILED_RETRYABLE", "FAILED_RETRYABLE", "FAILED_RETRYABLE", "FAILED_RETRYABLE"],
  );
  assert.deepEqual(
    retryableRows.map((row) => row.state),
    ["FAILED_RETRYABLE", "FAILED_RETRYABLE", "FAILED_RETRYABLE", "FAILED_RETRYABLE"],
  );
  assert.deepEqual(
    retryableRows.map((row) => row.failure_code),
    [
      "R2_TEMPORARY_FAILURE",
      "DB_TEMPORARY_FAILURE",
      "RPC_TEMPORARY_FAILURE",
      "INTERNAL_EVALUATION_FAILED",
    ],
  );

  assert.deepEqual(
    restartRequiredRows.map((row) => row.outcome),
    [
      "FAILED_RESTART_REQUIRED",
      "FAILED_RESTART_REQUIRED",
      "FAILED_RESTART_REQUIRED",
      "FAILED_RESTART_REQUIRED",
    ],
  );
  assert.deepEqual(
    restartRequiredRows.map((row) => row.state),
    [
      "FAILED_RESTART_REQUIRED",
      "FAILED_RESTART_REQUIRED",
      "FAILED_RESTART_REQUIRED",
      "FAILED_RESTART_REQUIRED",
    ],
  );
  assert.deepEqual(
    restartRequiredRows.map((row) => row.failure_code),
    ["R2_OBJECT_MISSING", "R2_SIZE_MISMATCH", "R2_DIGEST_MISMATCH", "SLUG_CONFLICT"],
  );

  for (const row of [...retryableRows, ...restartRequiredRows]) {
    assert.equal(typeof row.attempt_id, "string");
    assert.equal(typeof row.slug, "string");
    assert.equal(typeof row.attempt_version, "number");
    assert.equal(typeof row.retry_count, "number");
    assert.equal(typeof row.commit_count, "number");
    assert.equal(typeof row.failed_at, "string");
    assert.equal(typeof row.expires_at, "string");
  }
});

test("fail negative rows preserve privacy and exact return keys", () => {
  const rows = [
    failLeaseExpiredRow,
    failLeaseMismatchRow,
    failVersionMismatchRow,
    failBindingMismatchRow,
    failStateConflictRow,
    failInvalidInputRow,
  ];
  const expectedKeys = [
    "attempt_id",
    "attempt_version",
    "commit_count",
    "expires_at",
    "failed_at",
    "failure_code",
    "outcome",
    "retry_count",
    "slug",
    "state",
  ];

  assert.deepEqual(
    rows.map((row) => row.outcome),
    [
      "LEASE_EXPIRED",
      "LEASE_MISMATCH",
      "VERSION_MISMATCH",
      "BINDING_MISMATCH",
      "STATE_CONFLICT",
      "INVALID_INPUT",
    ],
  );
  for (const row of rows) {
    assert.equal(Object.keys(row).length, 10);
    assert.deepEqual(Object.keys(row).sort(), expectedKeys);
    for (const key of [
      "attempt_id",
      "slug",
      "state",
      "attempt_version",
      "retry_count",
      "commit_count",
      "failure_code",
      "failed_at",
      "expires_at",
    ] as const) {
      assert.equal(row[key], null);
    }
  }
});

test("fail contract constants guard failure-code and outcome drift", () => {
  assert.deepEqual(EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES, [
    "R2_TEMPORARY_FAILURE",
    "DB_TEMPORARY_FAILURE",
    "RPC_TEMPORARY_FAILURE",
    "INTERNAL_EVALUATION_FAILED",
    "R2_OBJECT_MISSING",
    "R2_SIZE_MISMATCH",
    "R2_DIGEST_MISMATCH",
    "SLUG_CONFLICT",
  ]);
  assert.deepEqual(EDU_PUBLISH_FAIL_COMMIT_OUTCOMES, [
    "FAILED_RETRYABLE",
    "FAILED_RESTART_REQUIRED",
    "LEASE_EXPIRED",
    "LEASE_MISMATCH",
    "VERSION_MISMATCH",
    "BINDING_MISMATCH",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ]);

  const successCodes = [
    failedRetryableRpcRow.failure_code,
    failedRetryableDbTemporaryRpcRow.failure_code,
    failedRetryableRpcTemporaryRpcRow.failure_code,
    failedRetryableInternalEvaluationRpcRow.failure_code,
    failedRestartRequiredRpcRow.failure_code,
    failedRestartRequiredSizeMismatchRpcRow.failure_code,
    failedRestartRequiredDigestMismatchRpcRow.failure_code,
    failedRestartRequiredSlugConflictRpcRow.failure_code,
  ];
  assert.deepEqual(successCodes, EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES);
  assert.deepEqual(
    [
      failLeaseExpiredRow.outcome,
      failLeaseMismatchRow.outcome,
      failVersionMismatchRow.outcome,
      failBindingMismatchRow.outcome,
      failStateConflictRow.outcome,
      failInvalidInputRow.outcome,
    ],
    EDU_PUBLISH_FAIL_COMMIT_OUTCOMES.slice(2),
  );
});

test("begin args preserve the exact five SQL argument names", () => {
  assert.equal(Object.keys(beginArgs).length, 5);
  assert.deepEqual(Object.keys(beginArgs).sort(), [
    "p_attempt_id",
    "p_declared_manifest_digest",
    "p_lease_owner",
    "p_manifest_schema_version",
    "p_slug",
  ]);
  assert.equal(beginArgs.p_manifest_schema_version, 1);
  assert.equal(beginArgs.p_lease_owner, LEASE_OWNER);
});

test("begin claim rows preserve VALIDATING state and own attempt identity", () => {
  const rows = [claimedRow, reclaimedRetryableRow, takenOverStaleLeaseRow];
  assert.deepEqual(
    rows.map((row) => row.outcome),
    ["CLAIMED", "RECLAIMED_RETRYABLE", "TAKEN_OVER_STALE_LEASE"],
  );
  for (const row of rows) {
    assert.equal(row.attempt_id, ATTEMPT_ID);
    assert.equal(row.slug, SLUG);
    assert.equal(row.state, "VALIDATING");
    assert.equal(typeof row.attempt_version, "number");
    assert.equal(typeof row.retry_count, "number");
    assert.equal(typeof row.commit_count, "number");
    assert.equal(typeof row.lease_expires_at, "string");
    assert.equal(row.expires_at, EXPIRES_AT);
    assert.equal(row.project_id, null);
  }
});

test("begin published replay preserves PUBLISHED project identity", () => {
  assert.equal(alreadyPublishedRow.outcome, "ALREADY_PUBLISHED");
  assert.equal(alreadyPublishedRow.attempt_id, ATTEMPT_ID);
  assert.equal(alreadyPublishedRow.slug, SLUG);
  assert.equal(alreadyPublishedRow.state, "PUBLISHED");
  assert.equal(alreadyPublishedRow.lease_expires_at, null);
  assert.equal(alreadyPublishedRow.expires_at, EXPIRES_AT);
  assert.equal(alreadyPublishedRow.project_id, PROJECT_ID);
});

test("begin negative rows hide every identity and state field", () => {
  const rows = [
    leaseActiveRow,
    attemptExpiredRow,
    bindingMismatchRow,
    beginStateConflictRow,
    retryExhaustedRow,
    beginInvalidInputRow,
  ];
  assert.deepEqual(
    rows.map((row) => row.outcome),
    [
      "LEASE_ACTIVE",
      "ATTEMPT_EXPIRED",
      "BINDING_MISMATCH",
      "STATE_CONFLICT",
      "RETRY_EXHAUSTED",
      "INVALID_INPUT",
    ],
  );
  for (const row of rows) {
    for (const key of [
      "attempt_id",
      "slug",
      "state",
      "attempt_version",
      "retry_count",
      "commit_count",
      "lease_expires_at",
      "expires_at",
      "project_id",
    ] as const) {
      assert.equal(row[key], null);
    }
  }
});

test("complete args preserve the exact 22 SQL argument names", () => {
  assert.equal(Object.keys(completeArgs).length, 22);
  assert.deepEqual(Object.keys(completeArgs).sort(), [
    "p_anon_id",
    "p_attempt_id",
    "p_author_name",
    "p_board_id",
    "p_classroom_url",
    "p_declared_manifest_digest",
    "p_expected_attempt_version",
    "p_expires_at",
    "p_files",
    "p_gallery_preview_url",
    "p_lease_owner",
    "p_lesson_id",
    "p_manifest_schema_version",
    "p_preview_url",
    "p_project_id",
    "p_public_url",
    "p_publish_quota_key",
    "p_request_id",
    "p_share_code",
    "p_slug",
    "p_title",
    "p_verified_manifest_digest",
  ]);
  assert.equal(completeArgs.p_manifest_schema_version, 1);
  assert.equal(completeArgs.p_lesson_id, 1);
  assert.equal(completeArgs.p_anon_id, "anon-123");
  assert.equal(completeArgs.p_board_id, COMPLETE_BOARD_ID);
  assert.equal(completeArgs.p_publish_quota_key, "guest:abc123:p1:nick:학생");

  assert.equal(Object.keys(completeArgsWithNullables).length, 22);
  assert.equal(completeArgsWithNullables.p_anon_id, null);
  assert.equal(completeArgsWithNullables.p_board_id, null);
});

test("complete args preserve the exact snake_case file representation", () => {
  assert.equal(Array.isArray(completeArgs.p_files), true);
  assert.deepEqual(Object.keys(completeArgs.p_files[0]!).sort(), [
    "content_type",
    "path",
    "size_bytes",
  ]);
  assert.equal("contentType" in completeArgs.p_files[0]!, false);
  assert.equal("sizeBytes" in completeArgs.p_files[0]!, false);
  assert.equal(completeArgs.p_files[0]!.path, "index.html");
  assert.equal(completeArgs.p_files[0]!.content_type, "text/html");
  assert.equal(completeArgs.p_files[0]!.size_bytes, 100);
});

test("complete success and replay rows share one exact non-null shape", () => {
  const rows = [completePublishedRow, completeAlreadyPublishedRow];
  const expectedKeys = [
    "attempt_id",
    "attempt_version",
    "classroom_url",
    "commit_count",
    "outcome",
    "preview_url",
    "project_id",
    "public_url",
    "published_at",
    "reservation_state",
    "retry_count",
    "slug",
    "state",
    "verified_manifest_digest",
  ];

  assert.deepEqual(
    rows.map((row) => row.outcome),
    ["PUBLISHED", "ALREADY_PUBLISHED"],
  );
  for (const row of rows) {
    assert.equal(Object.keys(row).length, 14);
    assert.deepEqual(Object.keys(row).sort(), expectedKeys);
    assert.equal(row.state, "PUBLISHED");
    assert.equal(row.reservation_state, "PROJECT_PUBLISHED");
    for (const key of [
      "attempt_id",
      "slug",
      "attempt_version",
      "retry_count",
      "commit_count",
      "project_id",
      "verified_manifest_digest",
      "published_at",
      "preview_url",
      "public_url",
      "classroom_url",
    ] as const) {
      assert.notEqual(row[key], null);
    }
  }

  const { outcome: publishedOutcome, ...publishedShape } = completePublishedRow;
  const { outcome: replayOutcome, ...replayShape } = completeAlreadyPublishedRow;
  assert.equal(publishedOutcome, "PUBLISHED");
  assert.equal(replayOutcome, "ALREADY_PUBLISHED");
  assert.deepEqual(replayShape, publishedShape);
});

test("complete negative rows preserve privacy and exact return keys", () => {
  const rows = [
    completeLeaseExpiredRow,
    completeLeaseMismatchRow,
    completeVersionMismatchRow,
    completeBindingMismatchRow,
    completeReservationMismatchRow,
    completeStateConflictRow,
    completeInvalidInputRow,
  ];
  const expectedOutcomes = [
    "LEASE_EXPIRED",
    "LEASE_MISMATCH",
    "VERSION_MISMATCH",
    "BINDING_MISMATCH",
    "RESERVATION_MISMATCH",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ];
  const expectedKeys = [
    "attempt_id",
    "attempt_version",
    "classroom_url",
    "commit_count",
    "outcome",
    "preview_url",
    "project_id",
    "public_url",
    "published_at",
    "reservation_state",
    "retry_count",
    "slug",
    "state",
    "verified_manifest_digest",
  ];
  const privateFields = [
    "attempt_id",
    "slug",
    "state",
    "attempt_version",
    "retry_count",
    "commit_count",
    "project_id",
    "verified_manifest_digest",
    "reservation_state",
    "published_at",
    "preview_url",
    "public_url",
    "classroom_url",
  ] as const;

  assert.deepEqual(rows.map((row) => row.outcome), expectedOutcomes);
  for (const row of rows) {
    assert.equal(Object.keys(row).length, 14);
    assert.deepEqual(Object.keys(row).sort(), expectedKeys);
    for (const key of privateFields) assert.equal(row[key], null);
  }
});

test("complete outcome constants prevent success and negative outcome drift", () => {
  const fixtureOutcomes = [
    completePublishedRow.outcome,
    completeAlreadyPublishedRow.outcome,
    completeLeaseExpiredRow.outcome,
    completeLeaseMismatchRow.outcome,
    completeVersionMismatchRow.outcome,
    completeBindingMismatchRow.outcome,
    completeReservationMismatchRow.outcome,
    completeStateConflictRow.outcome,
    completeInvalidInputRow.outcome,
  ];

  assert.deepEqual(
    [...fixtureOutcomes].sort(),
    [...EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES].sort(),
  );
  assert.deepEqual(
    [completePublishedRow.outcome, completeAlreadyPublishedRow.outcome].sort(),
    ["ALREADY_PUBLISHED", "PUBLISHED"],
  );
  assert.deepEqual(
    [
      completeLeaseExpiredRow.outcome,
      completeLeaseMismatchRow.outcome,
      completeVersionMismatchRow.outcome,
      completeBindingMismatchRow.outcome,
      completeReservationMismatchRow.outcome,
      completeStateConflictRow.outcome,
      completeInvalidInputRow.outcome,
    ].sort(),
    [
      "BINDING_MISMATCH",
      "INVALID_INPUT",
      "LEASE_EXPIRED",
      "LEASE_MISMATCH",
      "RESERVATION_MISMATCH",
      "STATE_CONFLICT",
      "VERSION_MISMATCH",
    ],
  );
});

test("complete type contract names stay aligned with the migration", () => {
  const source = readFileSync(
    resolve(process.cwd(), COMPLETE_MIGRATION_PATH),
    "utf8",
  ).toLowerCase();
  assert.match(
    source,
    /create or replace function public\.complete_edu_publish_commit_v1\s*\(/,
  );
  for (const argument of [
    "p_attempt_id",
    "p_slug",
    "p_manifest_schema_version",
    "p_declared_manifest_digest",
    "p_verified_manifest_digest",
    "p_lease_owner",
    "p_expected_attempt_version",
    "p_project_id",
    "p_share_code",
    "p_lesson_id",
    "p_author_name",
    "p_title",
    "p_anon_id",
    "p_board_id",
    "p_expires_at",
    "p_files",
    "p_preview_url",
    "p_gallery_preview_url",
    "p_public_url",
    "p_classroom_url",
    "p_request_id",
    "p_publish_quota_key",
  ]) {
    assert.match(source, new RegExp(`\\b${argument}\\b`), argument);
  }
  for (const column of [
    "outcome",
    "attempt_id",
    "slug",
    "state",
    "attempt_version",
    "retry_count",
    "commit_count",
    "project_id",
    "verified_manifest_digest",
    "reservation_state",
    "published_at",
    "preview_url",
    "public_url",
    "classroom_url",
  ]) {
    assert.match(source, new RegExp(`\\b${column}\\b`), column);
  }
  assert.match(source, /p_files\s+jsonb/);
  assert.match(source, /p_anon_id\s+text/);
  assert.match(source, /p_board_id\s+uuid/);
});
