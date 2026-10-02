import "server-only";

import { headObject, presignGetUrl, presignPutUrl } from "@/lib/r2/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listCardBoardFilesByCardIds } from "@/lib/data/cardFiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCardForUpload } from "@/lib/data/cards";
import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";

export class UploadIntentError extends Error {
  readonly code: string;
  readonly stage: "load_card" | "authorize_card_upload" | "create_file_row" | "create_storage_upload_url" | "build_file_record";
  readonly supabaseCode?: string;
  readonly diagnostics?: Record<string, unknown>;

  constructor(input: {
    code: string;
    message: string;
    stage: UploadIntentError["stage"];
    supabaseCode?: string;
    diagnostics?: Record<string, unknown>;
  }) {
    super(input.message);
    this.code = input.code;
    this.stage = input.stage;
    this.supabaseCode = input.supabaseCode;
    this.diagnostics = input.diagnostics;
  }
}

function buildCreateFileRowDiagnostics(input: {
  cardId: string;
  boardId?: string | null;
  wallId?: string | null;
  ownerId?: string | null;
  ownerUserId?: string | null;
  r2Key?: string | null;
  contentType?: string | null;
  mime?: string | null;
  originalName?: string | null;
  tags?: string[] | null;
  sizeBytes?: number | null;
  status: "pending" | "ready";
  insertColumns: string[];
  error?: { code?: string; message?: string } | null;
}) {
  const isRls = input.error?.code === "42501" || /row-level security|rls/i.test(input.error?.message ?? "");
  const notNullColumn = (input.error?.message ?? "").match(/null value in column "([^"]+)"/i)?.[1] ?? null;
  return {
    stage: "create_file_row",
    cardId: input.cardId,
    boardIdPresent: Boolean(input.boardId),
    wallIdPresent: Boolean(input.wallId),
    ownerUserIdPresent: Boolean(input.ownerUserId),
    ownerIdPresent: Boolean(input.ownerId),
    insertHasMime: Boolean(input.mime),
    insertHasContentType: Boolean(input.contentType),
    insertHasOwnerUserId: Boolean(input.ownerUserId),
    insertHasOwnerId: Boolean(input.ownerId),
    insertHasOriginalName: Boolean(input.originalName),
    insertHasTags: Array.isArray(input.tags),
    r2KeyPresent: Boolean(input.r2Key),
    contentTypePresent: Boolean(input.contentType),
    sizeBytesPresent: typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes),
    status: input.status,
    insertColumns: input.insertColumns,
    supabaseCode: input.error?.code ?? null,
    errorMessage: input.error?.message ?? null,
    notNullColumn,
    rlsHint: isRls ? "possible_rls_insert_policy_denial" : null,
  };
}

type CardUploadAuthorization = {
  allowed: boolean;
  reason:
    | "allowed"
    | "no_board_owner_match"
    | "no_membership"
    | "role_not_allowed";
  boardRole: ReturnType<typeof normalizeBoardRole>;
  isBoardOwner: boolean;
  isCardCreator: boolean;
  isBoardMember: boolean;
  canEditBoard: boolean;
};

async function authorizeCardUpload(input: {
  supabase: SupabaseClient;
  ownerId: string;
  boardId: string;
  boardOwnerId: string | null;
  cardOwnerId: string | null;
}): Promise<CardUploadAuthorization> {
  if (input.boardOwnerId === input.ownerId) {
    return {
      allowed: true,
      reason: "allowed",
      boardRole: "owner",
      isBoardOwner: true,
      isCardCreator: input.cardOwnerId === input.ownerId,
      isBoardMember: false,
      canEditBoard: true,
    };
  }
  const { data: boardRole, error: boardRoleError } = await input.supabase.rpc("board_role", { bid: input.boardId });
  if (boardRoleError) {
    throw new UploadIntentError({
      code: "upload_card_lookup_failed",
      message: boardRoleError.message,
      stage: "authorize_card_upload",
      supabaseCode: boardRoleError.code,
    });
  }
  const normalizedBoardRole = normalizeBoardRole(boardRole);
  const canEdit = canEditBoard(normalizedBoardRole);
  if (canEdit) {
    return {
      allowed: true,
      reason: "allowed",
      boardRole: normalizedBoardRole,
      isBoardOwner: normalizedBoardRole === "owner",
      isCardCreator: input.cardOwnerId === input.ownerId,
      isBoardMember: normalizedBoardRole !== null,
      canEditBoard: true,
    };
  }
  return {
    allowed: false,
    reason: normalizedBoardRole === null ? "no_membership" : "role_not_allowed",
    boardRole: normalizedBoardRole,
    isBoardOwner: false,
    isCardCreator: input.cardOwnerId === input.ownerId,
    isBoardMember: normalizedBoardRole !== null,
    canEditBoard: false,
  };
}

export type CardFile = {
  id: string;
  attachment_id?: string | null;
  file_id?: string | null;
  board_file_id?: string | null;
  card_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  created_at: string;
};

export type ShareCardFile = {
  fileId: string;
  cardId: string;
  filename: string;
  byteSize: number;
  contentType: string;
  createdAt: string;
};

const PUT_URL_EXPIRES_SECONDS = 900;
const GET_URL_EXPIRES_SECONDS = 600;

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  const fallback = cleaned || "file";

  return fallback.length > 200 ? fallback.slice(0, 200) : fallback;
}

function resolveSafeExtension(filename: string, contentType: string): string {
  const normalized = sanitizeFilename(filename).toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  const fromFilename = dotIndex > 0 ? normalized.slice(dotIndex + 1) : "";
  if (/^[a-z0-9]{1,10}$/.test(fromFilename)) {
    return fromFilename;
  }

  const mime = contentType.trim().toLowerCase();
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  return mimeToExt[mime] ?? "bin";
}

function resolveSafeBaseName(filename: string): string {
  const normalized = sanitizeFilename(filename);
  const dotIndex = normalized.lastIndexOf(".");
  const baseName = dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
  const trimmed = baseName.replace(/^[_\-.]+|[_\-.]+$/g, "");
  const fallback = trimmed.length > 0 ? trimmed : "file";
  return fallback.slice(0, 120);
}

export function buildCardUploadStorageKey(input: {
  boardId: string;
  cardId: string;
  fileId: string;
  filename: string;
  contentType: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const year = `${now.getUTCFullYear()}`;
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const safeBaseName = resolveSafeBaseName(input.filename);
  const safeExt = resolveSafeExtension(input.filename, input.contentType);
  return `gom/boards/${input.boardId}/cards/${input.cardId}/${year}/${month}/${input.fileId}-${safeBaseName}.${safeExt}`;
}

function isUniqueR2KeyViolation(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "23505" &&
    /files_r2_key_unique_idx|r2_key/i.test(error.message ?? "")
  );
}

function parsePositiveEnvNumber(name: string): number {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export async function listFilesByCardIds(
  cardIds: string[],
): Promise<Record<string, CardFile[]>> {
  if (cardIds.length === 0) {
    return {};
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("files")
    .select("id, card_id, filename, content_type, size_bytes, status, created_at")
    .in("card_id", cardIds)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const grouped: Record<string, CardFile[]> = {};

  for (const file of data ?? []) {
    grouped[file.card_id] = grouped[file.card_id] ?? [];
    grouped[file.card_id]?.push(file);
  }

  const cardBoardFiles = await listCardBoardFilesByCardIds(cardIds);
  for (const file of cardBoardFiles) {
    grouped[file.card_id] = grouped[file.card_id] ?? [];
    grouped[file.card_id]?.push({
      id: file.board_file_id,
      attachment_id: file.id,
      file_id: file.file_id,
      board_file_id: file.board_file_id,
      card_id: file.card_id,
      filename: file.filename,
      content_type: file.mime ?? "application/octet-stream",
      size_bytes: file.bytes,
      status: "ready",
      created_at: file.created_at,
    });
  }

  return grouped;
}

export async function listReadyFilesForCards(
  cardIds: string[],
): Promise<ShareCardFile[]> {
  if (cardIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("files")
    .select("id, card_id, filename, content_type, size_bytes, created_at")
    .in("card_id", cardIds)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data as
    | {
        id: string;
        card_id: string;
        filename: string;
        content_type: string;
        size_bytes: number;
        created_at: string;
      }[]
    | null;

  const legacyFiles = (rows ?? []).map((file) => ({
    fileId: file.id,
    cardId: file.card_id,
    filename: file.filename,
    byteSize: file.size_bytes,
    contentType: file.content_type,
    createdAt: file.created_at,
  }));

  const cardBoardFiles = await listCardBoardFilesByCardIds(cardIds);
  const boardFiles = cardBoardFiles.map((file) => ({
    fileId: file.board_file_id,
    cardId: file.card_id,
    filename: file.filename,
    byteSize: file.bytes,
    contentType: file.mime ?? "application/octet-stream",
    createdAt: file.created_at,
  }));

  return [...legacyFiles, ...boardFiles];
}

export async function createUploadIntent(input: {
  userId: string;
  cardId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  originalBytes?: number;
  storedBytes?: number;
  originalSizeBytes?: number;
  optimizedSizeBytes?: number;
  width?: number | null;
  height?: number | null;
  optimized?: boolean;
  isOptimized?: boolean;
  sha256Hex?: string | null;
  contentSha256?: string | null;
  optimizationFormat?: string | null;
}): Promise<{ fileId: string; uploadUrl?: string; deduped: boolean; r2Key?: string | null }> {
  const supabase = createSupabaseServerClient();

  return createUploadIntentWithOwner({
    supabase,
    ownerId: input.userId,
    cardId: input.cardId,
    filename: input.filename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    originalBytes: input.originalBytes,
    storedBytes: input.storedBytes,
    originalSizeBytes: input.originalSizeBytes,
    optimizedSizeBytes: input.optimizedSizeBytes,
    width: input.width,
    height: input.height,
    optimized: input.optimized,
    isOptimized: input.isOptimized,
    sha256Hex: input.sha256Hex,
    contentSha256: input.contentSha256,
    optimizationFormat: input.optimizationFormat,
  });
}

export async function createUploadIntentForOwner(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  cardId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  originalBytes?: number;
  storedBytes?: number;
  originalSizeBytes?: number;
  optimizedSizeBytes?: number;
  width?: number | null;
  height?: number | null;
  optimized?: boolean;
  isOptimized?: boolean;
  sha256Hex?: string | null;
  contentSha256?: string | null;
  optimizationFormat?: string | null;
  authzDiagnostics?: (details: {
    cardId: string;
    wallIdPresent: boolean;
    boardIdPresent: boolean;
    authUserIdPresent: boolean;
    boardOwnerIdPresent: boolean;
    ownerIdEqualsAuthUserId: boolean | null;
    boardOwnerIdEqualsAuthUserId: boolean | null;
    boardRoleResult: ReturnType<typeof normalizeBoardRole>;
    boardMembersRoleResult: ReturnType<typeof normalizeBoardRole>;
    authorizationDecision: "owner_fast_path" | "editable_role" | "forbidden";
    forbiddenReason:
      | "board_owner_missing"
      | "auth_user_mismatch"
      | "owner_fast_path_not_checked"
      | "board_role_denied"
      | "missing_board_relation"
      | "unknown";
  }) => void;
}): Promise<{ fileId: string; uploadUrl?: string; deduped: boolean; r2Key?: string | null }> {
  return createUploadIntentWithOwner({
    ...input,
    ownerId: input.ownerUserId,
  });
}

async function createUploadIntentWithOwner(input: {
  supabase: SupabaseClient;
  ownerId: string;
  cardId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  originalBytes?: number;
  storedBytes?: number;
  originalSizeBytes?: number;
  optimizedSizeBytes?: number;
  width?: number | null;
  height?: number | null;
  optimized?: boolean;
  isOptimized?: boolean;
  sha256Hex?: string | null;
  contentSha256?: string | null;
  optimizationFormat?: string | null;
  authzDiagnostics?: (details: {
    cardId: string;
    wallIdPresent: boolean;
    boardIdPresent: boolean;
    authUserIdPresent: boolean;
    boardOwnerIdPresent: boolean;
    ownerIdEqualsAuthUserId: boolean | null;
    boardOwnerIdEqualsAuthUserId: boolean | null;
    boardRoleResult: ReturnType<typeof normalizeBoardRole>;
    boardMembersRoleResult: ReturnType<typeof normalizeBoardRole>;
    authorizationDecision: "owner_fast_path" | "editable_role" | "forbidden";
    forbiddenReason:
      | "board_owner_missing"
      | "auth_user_mismatch"
      | "owner_fast_path_not_checked"
      | "board_role_denied"
      | "missing_board_relation"
      | "unknown";
  }) => void;
}): Promise<{ fileId: string; uploadUrl?: string; deduped: boolean; r2Key?: string | null }> {
  if (typeof input.ownerId !== "string" || input.ownerId.length === 0) {
    throw new Error("owner_id_required");
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("sizeBytes must be a positive number");
  }

  const safeFilename = sanitizeFilename(input.filename);
  const storedBytes = input.storedBytes ?? input.sizeBytes;
  const originalBytes = input.originalBytes ?? storedBytes;
  const originalSizeBytes = input.originalSizeBytes ?? originalBytes;
  const optimizedSizeBytes = input.optimizedSizeBytes ?? storedBytes;
  const optimized = input.optimized ?? input.isOptimized ?? false;
  const width = input.width ?? null;
  const height = input.height ?? null;
  const sha256Hex = input.sha256Hex ?? input.contentSha256 ?? null;
  const contentSha256 = input.contentSha256 ?? input.sha256Hex ?? null;
  const optimizationFormat = input.optimizationFormat ?? null;

  let cardData: Awaited<ReturnType<typeof loadCardForUpload>> = null;
  try {
    cardData = await loadCardForUpload({ supabase: input.supabase, cardId: input.cardId });
  } catch (error) {
    throw new UploadIntentError({
      code: "upload_card_lookup_failed",
      message: error instanceof Error ? error.message : "card_lookup_failed",
      stage: "load_card",
    });
  }

  if (!cardData) {
    throw new UploadIntentError({
      code: "upload_card_not_found",
      message: "card_not_found",
      stage: "load_card",
    });
  }

  const authz = await authorizeCardUpload({
    supabase: input.supabase,
    ownerId: input.ownerId,
    boardId: cardData.boardId,
    boardOwnerId: cardData.boardOwnerId,
    cardOwnerId: cardData.cardOwnerId,
  });
  const boardOwnerPresent = Boolean(cardData.boardOwnerId);
  const boardOwnerEqAuth = boardOwnerPresent ? cardData.boardOwnerId === input.ownerId : null;
  input.authzDiagnostics?.({
    cardId: input.cardId,
    wallIdPresent: Boolean(cardData.wallId),
    boardIdPresent: Boolean(cardData.boardId),
    authUserIdPresent: Boolean(input.ownerId),
    boardOwnerIdPresent: boardOwnerPresent,
    ownerIdEqualsAuthUserId: input.ownerId ? true : null,
    boardOwnerIdEqualsAuthUserId: boardOwnerEqAuth,
    boardRoleResult: authz.boardRole,
    boardMembersRoleResult: authz.boardRole,
    authorizationDecision: authz.allowed
      ? authz.isBoardOwner ? "owner_fast_path" : "editable_role"
      : "forbidden",
    forbiddenReason: authz.allowed
      ? "unknown"
      : !cardData.boardId || !cardData.wallId
        ? "missing_board_relation"
        : !boardOwnerPresent
          ? "board_owner_missing"
          : boardOwnerEqAuth === false
            ? "auth_user_mismatch"
            : authz.reason === "no_membership" || authz.reason === "role_not_allowed"
              ? "board_role_denied"
              : "unknown",
  });
  if (!authz.allowed) {
    console.warn("[files.createUploadIntentForOwner] upload_forbidden", {
      cardId: input.cardId,
      boardId: cardData.boardId,
      wallId: cardData.wallId,
      hasAuthUserId: Boolean(input.ownerId),
      isBoardOwner: authz.isBoardOwner,
      isCardCreator: authz.isCardCreator,
      isBoardMember: authz.isBoardMember,
      canEditBoard: authz.canEditBoard,
      boardRole: authz.boardRole,
      reason: authz.reason,
    });
    throw new UploadIntentError({
      code: "upload_forbidden",
      message: "card_forbidden",
      stage: "authorize_card_upload",
    });
  }

  const singleMaxBytes = parsePositiveEnvNumber("STORAGE_MAX_BYTES");
  const totalMaxBytes = parsePositiveEnvNumber("STORAGE_MAX_BYTES_PER_TENANT");

  if (storedBytes > singleMaxBytes) {
    throw new UploadIntentError({
      code: "upload_request_invalid",
      message: "file_too_large",
      stage: "build_file_record",
    });
  }

  const { data: totalBytes, error: totalError } = await input.supabase.rpc(
    "storage_total_bytes",
  );

  if (totalError) {
    throw new UploadIntentError({
      code: "upload_file_record_failed",
      message: totalError.message,
      stage: "build_file_record",
      supabaseCode: totalError.code,
    });
  }

  const currentTotal = totalBytes ?? 0;
  const projectedTotal = currentTotal + storedBytes;

  if (projectedTotal > totalMaxBytes) {
    throw new UploadIntentError({
      code: "upload_request_invalid",
      message: "total_storage_limit_exceeded",
      stage: "build_file_record",
    });
  }

  let fileId = "";
  let r2Key = "";
  let fileRow: { id: string } | null = null;
  let lastInsertError: { code?: string; message?: string } | null = null;
  let insertPayload: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    fileId = crypto.randomUUID();
    r2Key = buildCardUploadStorageKey({
      boardId: cardData.boardId,
      cardId: input.cardId,
      fileId,
      filename: input.filename,
      contentType: input.contentType || "application/octet-stream",
    });

    insertPayload = {
      id: fileId,
      card_id: input.cardId,
      owner_id: input.ownerId,
      owner_user_id: input.ownerId,
      r2_key: r2Key,
      filename: safeFilename,
      content_type: input.contentType || "application/octet-stream",
      mime: input.contentType || "application/octet-stream",
      size_bytes: storedBytes,
      stored_bytes: storedBytes,
      original_bytes: originalBytes,
      sha256_hex: sha256Hex,
      content_sha256: contentSha256,
      original_size_bytes: originalSizeBytes,
      optimized_size_bytes: optimizedSizeBytes,
      width,
      height,
      optimized,
      is_optimized: optimized,
      optimization_format: optimizationFormat,
      duration_ms: null,
      original_name: safeFilename,
      tags: [],
      deduped: false,
      status: "pending" as const,
    };

    const { data: insertedRow, error: insertError } = await input.supabase
      .from("files")
      .insert(insertPayload)
      .select("id")
      .single();

    if (!insertError) {
      fileRow = insertedRow as { id: string } | null;
      break;
    }

    lastInsertError = insertError;
    if (!isUniqueR2KeyViolation(insertError) || attempt === 2) {
      break;
    }
  }

  if (lastInsertError && !fileRow) {
    const diagnostics = buildCreateFileRowDiagnostics({
      cardId: input.cardId,
      boardId: cardData.boardId,
      wallId: cardData.wallId,
      ownerId: input.ownerId,
      ownerUserId: input.ownerId,
      r2Key,
      contentType: input.contentType,
      mime: typeof insertPayload?.mime === "string" ? insertPayload.mime : null,
      originalName: typeof insertPayload?.original_name === "string" ? insertPayload.original_name : null,
      tags: Array.isArray(insertPayload?.tags) ? insertPayload.tags as string[] : null,
      sizeBytes: storedBytes,
      status: "pending",
      insertColumns: Object.keys(insertPayload ?? {}),
      error: lastInsertError,
    });
    console.error("[files.createUploadIntentForOwner] create_file_row_failed", diagnostics);
    throw new UploadIntentError({
      code: "upload_file_record_failed",
      message: isUniqueR2KeyViolation(lastInsertError) ? "upload_key_conflict_retryable" : lastInsertError.message ?? "upload_file_record_failed",
      stage: "create_file_row",
      supabaseCode: lastInsertError.code,
      diagnostics,
    });
  }

  if (!fileRow) {
    throw new UploadIntentError({
      code: "upload_file_record_failed",
      message: "upload_file_row_missing",
      stage: "create_file_row",
    });
  }

  let uploadUrl: string;
  try {
    uploadUrl = await presignPutUrl({
      key: r2Key,
      contentType: input.contentType || "application/octet-stream",
      expiresSeconds: PUT_URL_EXPIRES_SECONDS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "storage_url_error";
    throw new UploadIntentError({
      code: "upload_storage_url_failed",
      message,
      stage: "create_storage_upload_url",
    });
  }

  return { fileId: fileRow.id, uploadUrl, deduped: false, r2Key };
}

export async function finalizeUpload(fileId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("unauthorized");
  }

  await finalizeUploadWithClient(supabase, fileId, userData.user.id);
}

export async function finalizeUploadForUser(fileId: string, userId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  await finalizeUploadWithClient(supabase, fileId, userId);
}

export async function finalizeUploadAsAdmin(fileId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await finalizeUploadWithClient(supabase, fileId);
}

async function finalizeUploadWithClient(
  supabase: SupabaseClient,
  fileId: string,
  userId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("files")
    .select(
      "id, owner_id, r2_key, size_bytes, stored_bytes, original_bytes, original_size_bytes, optimized_size_bytes, deduped, status",
    )
    .eq("id", fileId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("file_not_found");
    }

    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("file_not_found");
  }

  if (userId && data.owner_id !== userId) {
    throw new Error("file_forbidden");
  }

  const objectHead = await headObject(data.r2_key);

  if (!objectHead.exists) {
    throw new Error("업로드된 파일을 확인하지 못했습니다.");
  }

  if (
    objectHead.contentLength !== undefined &&
    objectHead.contentLength !== data.size_bytes
  ) {
    throw new Error("업로드된 파일 크기가 일치하지 않습니다.");
  }

  const { error: updateError } = await supabase
    .from("files")
    .update({ status: "ready" })
    .eq("id", fileId)
    .eq("status", "pending");

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (data.status === "pending") {
    const storedBytes =
      typeof data.stored_bytes === "number" && Number.isFinite(data.stored_bytes)
        ? data.stored_bytes
        : data.size_bytes;
    const originalBytes =
      typeof data.original_bytes === "number" && Number.isFinite(data.original_bytes)
        ? data.original_bytes
        : storedBytes;
    const originalSizeBytes =
      typeof data.original_size_bytes === "number" && Number.isFinite(data.original_size_bytes) && data.original_size_bytes > 0
        ? data.original_size_bytes
        : originalBytes;
    const optimizedSizeBytes =
      typeof data.optimized_size_bytes === "number" && Number.isFinite(data.optimized_size_bytes) && data.optimized_size_bytes > 0
        ? data.optimized_size_bytes
        : storedBytes;
    const savedBytes = calculateSavedBytes(originalBytes, storedBytes, false);
    await updateStorageUsage(supabase, data.owner_id, {
      usedBytes: storedBytes,
      savedBytes,
    });
    await recordFileSavingsEvent(supabase, {
      userId: data.owner_id,
      kind: "optimized",
      originalBytes: originalSizeBytes,
      optimizedBytes: optimizedSizeBytes,
      reusedFileId: null,
    });
  }
}

function calculateSavedBytes(
  originalBytes: number | null | undefined,
  storedBytes: number | null | undefined,
  deduped: boolean,
): number {
  const original = typeof originalBytes === "number" && Number.isFinite(originalBytes) ? originalBytes : 0;
  const stored = typeof storedBytes === "number" && Number.isFinite(storedBytes) ? storedBytes : 0;
  const optimizedSaved = Math.max(0, original - stored);
  const dedupSaved = deduped ? stored : 0;
  return optimizedSaved + dedupSaved;
}

async function recordFileSavingsEvent(
  supabase: SupabaseClient,
  input: {
    userId: string;
    kind: "optimized" | "dedup_reuse";
    originalBytes: number;
    optimizedBytes: number;
    reusedFileId: string | null;
  },
): Promise<void> {
  if (!input.userId) return;
  const originalBytes = Math.max(0, Math.round(input.originalBytes ?? 0));
  const optimizedBytes = Math.max(0, Math.round(input.optimizedBytes ?? 0));
  const { error } = await supabase.from("file_savings_events").insert({
    user_id: input.userId,
    kind: input.kind,
    original_bytes: originalBytes,
    optimized_bytes: optimizedBytes,
    reused_file_id: input.reusedFileId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function updateStorageUsage(
  supabase: SupabaseClient,
  ownerId: string,
  input: { usedBytes: number; savedBytes: number },
): Promise<void> {
  if (!Number.isFinite(input.usedBytes) || !Number.isFinite(input.savedBytes)) {
    return;
  }

  const usedBytes = Math.max(0, Math.round(input.usedBytes));
  const savedBytes = Math.max(0, Math.round(input.savedBytes));

  if (usedBytes === 0 && savedBytes === 0) {
    return;
  }

  const { error } = await supabase.rpc("storage_usage_increment", {
    input_user_id: ownerId,
    input_used_bytes: usedBytes,
    input_saved_bytes: savedBytes,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getDownloadUrl(fileId: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("files")
    .select("r2_key, status")
    .eq("id", fileId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("파일을 찾을 수 없습니다.");
    }

    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("파일을 찾을 수 없습니다.");
  }

  if (data.status !== "ready") {
    throw new Error("파일이 아직 준비되지 않았습니다.");
  }

  return presignGetUrl({
    key: data.r2_key,
    expiresSeconds: GET_URL_EXPIRES_SECONDS,
  });
}
