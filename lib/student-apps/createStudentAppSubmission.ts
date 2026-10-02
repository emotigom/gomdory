import { prepareStudentStaticAppForStorage } from "@/lib/student-apps/staticAppPrepareForStorage";
import { buildStudentAppSubmissionPrefix } from "@/lib/student-apps/studentAppStorageKeys";
import { deleteStudentAppSubmissionObjectsFromR2, putStudentAppSubmissionFilesToR2 } from "@/lib/student-apps/storeStudentAppSubmissionFiles";
import { createSubmissionStatusCapability, hashSubmissionStatusCapability } from "@/lib/student-apps/submissionStatusCapability";

type QueryError = { message?: string } | null;
type SubmissionRow = { id: string; board_id: string; title: string; status: string; created_at: string; version: number; is_latest: boolean; previous_submission_id: string | null };
type PreviousSubmissionRow = { id: string; version: number | null };
type SupabaseQueryResponse<T> = Promise<{ data: T | null; error: QueryError }>;
type SupabaseChain = {
  select: (columns: string) => SupabaseChain;
  eq: (column: string, value: unknown) => SupabaseChain;
  is: (column: string, value: unknown) => SupabaseChain;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseChain;
  limit: (count: number) => SupabaseChain;
  maybeSingle: <T>() => SupabaseQueryResponse<T>;
  single: <T>() => SupabaseQueryResponse<T>;
  insert: (values: unknown) => SupabaseChain;
  update: (values: Record<string, unknown>) => SupabaseChain;
  delete: () => SupabaseChain;
};

type SupabaseLike = { from: (table: string) => SupabaseChain };

type ErrorWithCode = Error & { code?: string };
const makeCodedError = (message: string, code: string): ErrorWithCode => { const error = new Error(message) as ErrorWithCode; error.code = code; return error; };
const toAppKey = (title: string) => {
  const cleaned = title.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return cleaned || "app";
};

export async function createStudentAppSubmission(input: { bucket: R2Bucket; supabase: SupabaseLike; userId?: string | null; boardId: string; wallId?: string | null; cardId?: string | null; classId?: string | null; classSessionId?: string | null; authorClientId?: string | null; submittedByName?: string | null; studentNote?: string | null; ownership?: { version: number; participantOwnerHash: string } | null; rawPayload: unknown; }) {
  // Decode, normalize, and validate once. The exact prepared byte content is
  // then reused for sequential R2 writes below.
  const prepared = await prepareStudentStaticAppForStorage(input.rawPayload);
  const dryRun = prepared;
  if (!dryRun.normalized.ok || !dryRun.validation.ok) return { ok: false as const, reason: "validation_failed" as const, dryRun };

  const boardRes = await input.supabase.from("boards").select("id, owner_id").eq("id", input.boardId).maybeSingle();
  if (boardRes.error) throw new Error("board_lookup_failed");
  if (!boardRes.data) throw makeCodedError("forbidden_board", "forbidden_board");

  const warnings = dryRun.validation.manifest.safety.warnings ?? [];
  const fileCount = dryRun.validation.manifest.files.length;
  const totalSizeBytes = dryRun.validation.manifest.totalSizeBytes;
  const entryFile = dryRun.validation.manifest.entryFile;
  const appKey = toAppKey(dryRun.title);

  let previousSubmissionId: string | null = null;
  let version = 1;
  if (input.classSessionId && input.authorClientId) {
    const previousRes = await input.supabase.from("student_app_submissions").select("id, version").eq("board_id", input.boardId).eq("class_session_id", input.classSessionId).eq("author_client_id", input.authorClientId).eq("app_key", appKey).eq("is_latest", true).is("deleted_at", null).order("version", { ascending: false }).limit(1).maybeSingle<PreviousSubmissionRow>();
    if (previousRes.error) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
    if (previousRes.data?.id) { previousSubmissionId = previousRes.data.id; version = (previousRes.data.version ?? 0) + 1; }
  }

  // This is intentionally generated only after trusted context is resolved.
  // The raw value remains in memory until the complete upload succeeds.
  const statusCapability = input.ownership ? createSubmissionStatusCapability() : null;
  const statusCapabilityHash = statusCapability ? hashSubmissionStatusCapability(statusCapability) : null;

  const inserted = await input.supabase.from("student_app_submissions").insert({
    board_id: input.boardId, wall_id: input.wallId ?? null, card_id: input.cardId ?? null, class_id: input.classId ?? null,
    class_session_id: input.classSessionId ?? null, author_client_id: input.authorClientId ?? null, app_key: appKey, version, previous_submission_id: previousSubmissionId, is_latest: true,
    submitted_by_name: input.submittedByName ?? null, submitted_by_user_id: input.userId ?? null, title: dryRun.title, status: "submitted", source: "manual_files",
    ownership_version: input.ownership?.version ?? null, owner_participant_hash: input.ownership?.participantOwnerHash ?? null,
    status_capability_hash: statusCapabilityHash,
    validation: { ok: dryRun.validation.ok, errors: dryRun.validation.errors, warnings }, manifest: dryRun.validation.manifest,
    summary: { fileCount, totalSizeBytes, warnings, entryFile }, student_note: input.studentNote ?? null, r2_prefix: null,
  }).select("id, board_id, title, status, created_at, version, is_latest, previous_submission_id").single();
  if (inserted.error || !inserted.data) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");

  const submissionId = (inserted.data as SubmissionRow).id;
  const prefix = buildStudentAppSubmissionPrefix({ boardId: input.boardId, submissionId });
  try {
    const stored = await putStudentAppSubmissionFilesToR2({ bucket: input.bucket, prefix, files: prepared.filesForStorage, manifest: dryRun.validation.manifest });
    const now = new Date().toISOString();
    const up = await (input.supabase.from("student_app_submissions").update({ r2_prefix: prefix, stored_at: now, updated_at: now }).eq("id", submissionId) as unknown as { error: QueryError });
    if (up.error) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
    const fileIns = await (input.supabase.from("student_app_submission_files").insert(stored.files.map((f) => ({ submission_id: submissionId, path: f.path, r2_key: f.r2Key, content_type: f.contentType, size_bytes: f.sizeBytes, sha256: f.sha256 }))) as unknown as { error: QueryError });
    if (fileIns.error) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
    if (previousSubmissionId) {
      const previousUpdate = await (input.supabase.from("student_app_submissions").update({ is_latest: false }).eq("id", previousSubmissionId) as unknown as { error: QueryError });
      if (previousUpdate.error) throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
    }
  } catch (e) {
    const manifestKey = `${prefix}manifest.json`;
    const keys = [manifestKey, ...dryRun.validation.manifest.files.map((f) => `${prefix}${f.path}`)];
    await deleteStudentAppSubmissionObjectsFromR2({ bucket: input.bucket, keys });
    await input.supabase.from("student_app_submissions").delete().eq("id", submissionId);
    throw e;
  }

  return {
    ok: true as const,
    submission: { id: submissionId, boardId: (inserted.data as SubmissionRow).board_id, title: (inserted.data as SubmissionRow).title, status: (inserted.data as SubmissionRow).status, version: (inserted.data as SubmissionRow).version, isLatest: (inserted.data as SubmissionRow).is_latest, previousSubmissionId: (inserted.data as SubmissionRow).previous_submission_id, fileCount, totalSizeBytes, createdAt: (inserted.data as SubmissionRow).created_at, ...(statusCapability ? { statusCapability } : {}) },
    safety: dryRun.validation.manifest.safety,
  };
}
