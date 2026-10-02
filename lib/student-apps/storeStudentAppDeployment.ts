import { prepareStudentStaticAppForStorage } from "./staticAppPrepareForStorage";
import { buildStudentAppDeploymentPrefix } from "./studentAppStorageKeys";
import { deleteStudentAppStoredObjectsFromR2, putStudentAppFilesToR2 } from "./studentAppR2Storage";

type QueryError = { message?: string } | null;

type QueryResult<T> = Promise<{ data: T | null; error: QueryError }>;
type BoardLookupRow = {
  id: string;
  owner_id: string;
  class_id: string | null;
};

type DeploymentInsertRow = {
  id: string;
  board_id: string;
  card_id: string | null;
  status: string;
  title: string;
  slug: string;
  version: number;
  file_count: number;
  total_size_bytes: number;
  entry_file: string;
  created_at: string;
  stored_at: string;
};

type DeploymentFileInsertRow = {
  id: string;
};


type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => QueryResult<BoardLookupRow>;
      };
      single: () => QueryResult<DeploymentInsertRow>;
    };
    insert: (values: unknown) => {
      select: (columns: string) => {
        single: () => QueryResult<DeploymentInsertRow>;
      } & QueryResult<DeploymentFileInsertRow[]>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: QueryError }>;
    };
  };
};

type ErrorWithCode = Error & { code?: string };


const makeCodedError = (message: string, code: string): ErrorWithCode => {
  const error = new Error(message) as ErrorWithCode;
  error.code = code;
  return error;
};

export async function storeStudentAppDeployment(input: {
  bucket: R2Bucket;
  supabase: SupabaseLike;
  userId: string;
  boardId: string;
  wallId?: string | null;
  cardId?: string | null;
  classId?: string | null;
  rawPayload: unknown;
  sourceSubmissionId?: string | null;
}) {
  const prepared = await prepareStudentStaticAppForStorage(input.rawPayload);
  if (!prepared.normalized.ok || !prepared.validation.ok) {
    return { ok: false as const, reason: "validation_failed" as const, dryRun: prepared };
  }

  const boardRes = await input.supabase.from("boards").select("id, owner_id, class_id").eq("id", input.boardId).maybeSingle();
  if (boardRes.error) throw new Error("board_lookup_failed");
  if (!boardRes.data || boardRes.data.owner_id !== input.userId) {
    throw makeCodedError("forbidden_board", "forbidden_board");
  }

  const deploymentId = crypto.randomUUID();
  const version = 1;
  const safeTitle = prepared.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  const slug = safeTitle && /^[a-z0-9-]+$/.test(safeTitle) ? safeTitle.slice(0, 40) : `app-${deploymentId.slice(0, 8)}`;
  const r2Prefix = buildStudentAppDeploymentPrefix({ boardId: input.boardId, deploymentId, version });

  const stored = await putStudentAppFilesToR2({
    bucket: input.bucket,
    prefix: r2Prefix,
    files: prepared.filesForStorage,
    manifest: prepared.validation.manifest,
  });

  const writtenKeys = [...stored.files.map((f) => f.r2Key), stored.manifestKey];

  const depInsert = await input.supabase
    .from("student_app_deployments")
    .insert({
      id: deploymentId,
      board_id: input.boardId,
      wall_id: input.wallId ?? null,
      card_id: input.cardId ?? null,
      class_id: input.classId ?? boardRes.data.class_id ?? null,
      created_by: input.userId,
      title: prepared.title,
      slug,
      version,
      status: "stored",
      source: prepared.source,
      entry_file: prepared.validation.manifest.entryFile,
      r2_prefix: r2Prefix,
      manifest: prepared.validation.manifest,
      safety: prepared.validation.manifest.safety,
      file_count: prepared.validation.manifest.files.length,
      total_size_bytes: prepared.validation.manifest.totalSizeBytes,
      stored_at: new Date().toISOString(),
      source_submission_id: input.sourceSubmissionId ?? null,
    })
    .select("id, board_id, card_id, status, title, slug, version, file_count, total_size_bytes, entry_file, created_at, stored_at")
    .single();

  if (depInsert.error || !depInsert.data) {
    await deleteStudentAppStoredObjectsFromR2({ bucket: input.bucket, keys: writtenKeys });
    throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
  }

  const filesInsert = await input.supabase
    .from("student_app_deployment_files")
    .insert(
      stored.files.map((file) => ({
        deployment_id: deploymentId,
        path: file.path,
        r2_key: file.r2Key,
        content_type: file.contentType,
        size_bytes: file.sizeBytes,
        sha256: file.sha256,
      })),
    )
    .select("id");

  if (
    filesInsert.error
    || !Array.isArray(filesInsert.data)
    || filesInsert.data.length !== stored.files.length
  ) {
    await input.supabase.from("student_app_deployments").delete().eq("id", deploymentId);
    await deleteStudentAppStoredObjectsFromR2({ bucket: input.bucket, keys: writtenKeys });
    throw makeCodedError("storage_schema_unavailable", "storage_schema_unavailable");
  }

  return {
    ok: true as const,
    deployment: {
      id: depInsert.data.id,
      boardId: depInsert.data.board_id,
      cardId: depInsert.data.card_id,
      status: depInsert.data.status,
      title: depInsert.data.title,
      slug: depInsert.data.slug,
      version: depInsert.data.version,
      fileCount: depInsert.data.file_count,
      totalSizeBytes: depInsert.data.total_size_bytes,
      entryFile: depInsert.data.entry_file,
      createdAt: depInsert.data.created_at,
      storedAt: depInsert.data.stored_at,
    },
  };
}
