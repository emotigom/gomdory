import "server-only";

import { presignGetUrl, presignPutUrl } from "@/lib/r2/client";
import { buildSoftDeletePayload } from "@/lib/db/softDelete";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/admin";

const PUT_URL_EXPIRES_SECONDS = 900;
const GET_URL_EXPIRES_SECONDS = 600;

export type BoardFileVariant = "original" | "optimized" | "thumb";

export type BoardFile = {
  id: string;
  board_id: string;
  owner_id: string;
  r2_key: string;
  filename: string;
  bytes: number;
  mime: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  tags: string[];
  is_favorite: boolean;
  last_used_at: string | null;
  deleted_at: string | null;
  hash_sha256: string | null;
  variant: BoardFileVariant;
  original_bytes: number | null;
  optimized_bytes: number | null;
  bytes_saved: number | null;
};

type BoardFileUpdatePayload = Database["public"]["Tables"]["board_files"]["Update"];

type DeletedFileReference = Pick<BoardFile, "id" | "board_id" | "filename" | "r2_key"> & {
  file_id?: string | null;
  original_file_deleted?: boolean;
};

function normalizeDeletedFileReference(row: unknown): DeletedFileReference {
  if (!row || typeof row !== "object") {
    throw new Error("삭제된 파일 참조 정보를 확인하지 못했습니다.");
  }

  const candidate = row as Record<string, unknown>;
  const { id, board_id, filename, r2_key, file_id } = candidate;

  if (
    typeof id !== "string" ||
    typeof board_id !== "string" ||
    typeof filename !== "string" ||
    typeof r2_key !== "string" ||
    (file_id !== undefined && file_id !== null && typeof file_id !== "string")
  ) {
    throw new Error("삭제된 파일 참조 정보가 올바르지 않습니다.");
  }

  return {
    id,
    board_id,
    filename,
    r2_key,
    file_id: file_id ?? null,
  };
}

export function sanitizeBoardFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  const fallback = cleaned || "file";

  return fallback.length > 200 ? fallback.slice(0, 200) : fallback;
}

function parsePositiveEnvNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function ensureBoardOwnership(boardId: string, ownerId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.owner_id !== ownerId) {
    throw new Error("보드를 찾을 수 없습니다.");
  }
}

function generateR2Key(boardId: string, filename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  return `boards/${boardId}/${year}/${month}/${crypto.randomUUID()}-${filename}`;
}

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "video/", "application/vnd", "text/"];

export const BOARD_FILE_SELECT =
  "id, board_id, owner_id, r2_key, filename, bytes, mime, width, height, created_at, tags, is_favorite, last_used_at, deleted_at, hash_sha256, variant, original_bytes, optimized_bytes, bytes_saved";

const BOARD_FILE_SOFT_DELETE_FALLBACK_ERROR_TOKENS = ["schema cache", "could not find the", "column"];

export function shouldRetryBoardFileSoftDeleteWithMinimalPayload(message: string): boolean {
  const normalized = message.toLowerCase();
  return BOARD_FILE_SOFT_DELETE_FALLBACK_ERROR_TOKENS.some((token) => normalized.includes(token));
}

type UploadPlanInput = {
  boardId: string;
  filename: string;
  bytes: number;
  mime?: string | null;
  hashSha256: string;
  width?: number | null;
  height?: number | null;
  originalBytes?: number | null;
  optimizedBytes?: number | null;
  variant?: BoardFileVariant;
  ownerId?: string;
};

export async function createBoardUploadUrl(input: {
  boardId: string;
  filename: string;
  bytes: number;
  mime?: string | null;
}): Promise<{ uploadUrl: string; method: "PUT"; r2Key: string }>
export async function createBoardUploadUrl(input: {
  boardId: string;
  filename: string;
  bytes: number;
  mime?: string | null;
  ownerId: string;
}): Promise<{ uploadUrl: string; method: "PUT"; r2Key: string }>
export async function createBoardUploadUrl(input: {
  boardId: string;
  filename: string;
  bytes: number;
  mime?: string | null;
  ownerId?: string;
}): Promise<{ uploadUrl: string; method: "PUT"; r2Key: string }> {
  const supabase = createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = input.ownerId ?? userResult.user?.id;

  if (!ownerId) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  if (!Number.isFinite(input.bytes) || input.bytes <= 0) {
    throw new Error("유효한 파일 크기가 필요합니다.");
  }

  const safeFilename = sanitizeBoardFilename(input.filename);
  const maxBytes = parsePositiveEnvNumber("BOARD_FILES_MAX_BYTES", 200 * 1024 * 1024);

  if (input.bytes > maxBytes) {
    throw new Error("파일 크기가 허용 한도를 초과했습니다.");
  }

  const mime = (input.mime || "").toLowerCase();
  if (mime && !ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new Error("지원하지 않는 파일 형식입니다.");
  }

  await ensureBoardOwnership(input.boardId, ownerId);

  const r2Key = generateR2Key(input.boardId, safeFilename);
  const uploadUrl = await presignPutUrl({
    key: r2Key,
    contentType: mime || "application/octet-stream",
    expiresSeconds: PUT_URL_EXPIRES_SECONDS,
  });

  return { uploadUrl, method: "PUT", r2Key };
}

export async function createBoardUploadPlan(
  input: UploadPlanInput,
): Promise<{ deduped: true; file: BoardFile } | { deduped: false; uploadUrl: string; r2Key: string }> {
  const supabase = createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = input.ownerId ?? userResult.user?.id;
  if (!ownerId) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  if (!Number.isFinite(input.bytes) || input.bytes <= 0) {
    throw new Error("유효한 파일 크기가 필요합니다.");
  }

  const safeFilename = sanitizeBoardFilename(input.filename);
  const maxBytes = parsePositiveEnvNumber("BOARD_FILES_MAX_BYTES", 200 * 1024 * 1024);

  if (input.bytes > maxBytes) {
    throw new Error("파일 크기가 허용 한도를 초과했습니다.");
  }

  const mime = (input.mime || "").toLowerCase();
  if (mime && !ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new Error("지원하지 않는 파일 형식입니다.");
  }

  await ensureBoardOwnership(input.boardId, ownerId);

  if (!input.hashSha256) {
    throw new Error("파일 무결성 해시가 필요합니다.");
  }

  const variant = input.variant ?? "optimized";

  const { data: dupRow, error: dupError } = await supabase
    .from("board_files")
    .select(BOARD_FILE_SELECT)
    .eq("owner_id", ownerId)
    .eq("hash_sha256", input.hashSha256)
    .eq("variant", variant)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dupError) {
    throw new Error(dupError.message);
  }

  if (dupRow) {
    return { deduped: true, file: dupRow as BoardFile };
  }

  const r2Key = generateR2Key(input.boardId, safeFilename);
  const uploadUrl = await presignPutUrl({
    key: r2Key,
    contentType: mime || "application/octet-stream",
    expiresSeconds: PUT_URL_EXPIRES_SECONDS,
  });

  return { deduped: false, uploadUrl, r2Key };
}

export async function findBoardFileByHash(input: {
  ownerId: string;
  sha256: string;
  variant?: BoardFileVariant;
}): Promise<BoardFile | null> {
  if (!input.ownerId || !input.sha256) {
    throw new Error("ownerId and sha256 are required.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("board_files")
    .select(BOARD_FILE_SELECT)
    .eq("owner_id", input.ownerId)
    .eq("hash_sha256", input.sha256)
    .eq("variant", input.variant ?? "optimized")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as BoardFile | null) ?? null;
}

export async function commitBoardFile(input: {
  boardId: string;
  r2Key: string;
  filename: string;
  bytes: number;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  hashSha256?: string | null;
  variant?: BoardFileVariant;
  originalBytes?: number | null;
  optimizedBytes?: number | null;
  bytesSaved?: number | null;
}): Promise<BoardFile> {
  const supabase = createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = userResult.user?.id;
  if (!ownerId) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  await ensureBoardOwnership(input.boardId, ownerId);

  const safeFilename = sanitizeBoardFilename(input.filename);
  const { data, error } = await supabase
    .from("board_files")
    .insert({
      board_id: input.boardId,
      owner_id: ownerId,
      inserted_by: ownerId,
      r2_key: input.r2Key,
      filename: safeFilename,
      bytes: input.bytes,
      mime: input.mime ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      hash_sha256: input.hashSha256 ?? null,
      variant: input.variant ?? "optimized",
      original_bytes: input.originalBytes ?? null,
      optimized_bytes: input.optimizedBytes ?? null,
      bytes_saved: input.bytesSaved ?? null,
    })
    .select(BOARD_FILE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("파일 정보를 저장하지 못했습니다.");
  }

  return data as BoardFile;
}

export async function listBoardFiles(boardId: string): Promise<BoardFile[]> {
  const supabase = createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = userResult.user?.id;
  if (!ownerId) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  const { data, error } = await supabase
    .from("board_files")
    .select(BOARD_FILE_SELECT)
    .eq("board_id", boardId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BoardFile[];
}

export async function getBoardFileReadUrl(r2Key: string): Promise<string> {
  return presignGetUrl({ key: r2Key, expiresSeconds: GET_URL_EXPIRES_SECONDS });
}

export type BoardFileLibrarySort = "recent" | "name" | "size";

type BoardFileLibraryCursor = {
  sort: BoardFileLibrarySort;
  id: string;
  value: string | number;
  lastUsedAt?: string | null;
  createdAt?: string | null;
};

function encodeCursor(cursor: BoardFileLibraryCursor | null): string | null {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor)).toString("base64");
}

function decodeCursor(cursor: string | null): BoardFileLibraryCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BoardFileLibraryCursor;
  } catch (error) {
    console.warn("Failed to decode board file cursor", error);
    return null;
  }
}

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

export async function listBoardFileLibrary(input: {
  query?: string | null;
  tag?: string | null;
  boardId?: string | null;
  type?: "image" | "pdf" | "audio" | "video" | "any";
  sort?: BoardFileLibrarySort;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: BoardFile[]; nextCursor: string | null }> {
  const supabase = createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = userResult.user?.id;
  if (!ownerId) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  const limit = Math.min(50, Math.max(1, input.limit ?? 24));
  const sort = input.sort ?? "recent";
  const decoded = decodeCursor(input.cursor ?? null);

  let query = supabase
    .from("board_files")
    .select(BOARD_FILE_SELECT)
    .eq("owner_id", ownerId)
    .is("deleted_at", null);

  if (input.query) {
    const trimmedQuery = input.query.trim();
    if (trimmedQuery) {
      const tagQuery = trimmedQuery.toLowerCase();
      query = query.or(`filename.ilike.%${trimmedQuery}%,tags.cs.{${tagQuery}}`);
    }
  }

  if (input.tag) {
    query = query.contains("tags", [input.tag]);
  }

  if (input.boardId) {
    query = query.eq("board_id", input.boardId);
  }

  if (input.type && input.type !== "any") {
    if (input.type === "image") {
      query = query.ilike("mime", "image/%");
    } else if (input.type === "pdf") {
      query = query.eq("mime", "application/pdf");
    } else if (input.type === "audio") {
      query = query.ilike("mime", "audio/%");
    } else if (input.type === "video") {
      query = query.ilike("mime", "video/%");
    }
  }

  if (sort === "name") {
    query = query.order("filename", { ascending: true }).order("id", { ascending: true });
    if (decoded && decoded.sort === "name") {
      const filename = encodeFilterValue(String(decoded.value));
      const id = encodeFilterValue(decoded.id);
      query = query.or(`filename.gt.${filename},and(filename.eq.${filename},id.gt.${id})`);
    }
  } else if (sort === "size") {
    query = query.order("bytes", { ascending: false }).order("id", { ascending: false });
    if (decoded && decoded.sort === "size") {
      const bytes = encodeFilterValue(String(decoded.value));
      const id = encodeFilterValue(decoded.id);
      query = query.or(`bytes.lt.${bytes},and(bytes.eq.${bytes},id.lt.${id})`);
    }
  } else {
    query = query
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (decoded && decoded.sort === "recent") {
      const lastUsedAt = decoded.lastUsedAt ? encodeFilterValue(decoded.lastUsedAt) : null;
      const createdAt = decoded.createdAt ? encodeFilterValue(decoded.createdAt) : null;
      const id = encodeFilterValue(decoded.id);

      if (lastUsedAt) {
        const segments = [
          `last_used_at.lt.${lastUsedAt}`,
          `and(last_used_at.eq.${lastUsedAt},created_at.lt.${createdAt})`,
          `and(last_used_at.eq.${lastUsedAt},created_at.eq.${createdAt},id.lt.${id})`,
          "last_used_at.is.null",
        ];
        query = query.or(segments.join(","));
      } else if (createdAt) {
        const segments = [
          `and(last_used_at.is.null,created_at.lt.${createdAt})`,
          `and(last_used_at.is.null,created_at.eq.${createdAt},id.lt.${id})`,
        ];
        query = query.or(segments.join(","));
      }
    }
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []) as BoardFile[];
  const lastItem = items[items.length - 1];
  let nextCursor: string | null = null;

  if (lastItem && items.length === limit) {
    if (sort === "name") {
      nextCursor = encodeCursor({ sort, id: lastItem.id, value: lastItem.filename });
    } else if (sort === "size") {
      nextCursor = encodeCursor({ sort, id: lastItem.id, value: lastItem.bytes });
    } else {
      nextCursor = encodeCursor({
        sort,
        id: lastItem.id,
        value: lastItem.last_used_at ?? lastItem.created_at,
        lastUsedAt: lastItem.last_used_at,
        createdAt: lastItem.created_at,
      });
    }
  }

  return { items, nextCursor };
}

export async function listBoardFileTagSuggestions(input?: {
  days?: number;
  limit?: number;
}): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  const ownerId = userResult.user?.id;
  if (!ownerId) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  const days = Math.min(180, Math.max(1, input?.days ?? 60));
  const limit = Math.min(30, Math.max(1, input?.limit ?? 12));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("board_files")
    .select("tags, created_at")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .gte("created_at", since);

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => {
    const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
    tags.forEach((tag) => {
      const trimmed = typeof tag === "string" ? tag.trim() : "";
      if (!trimmed) return;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export async function updateBoardFileMetadata(input: {
  fileId: string;
  ownerId: string;
  tags?: string[] | null;
  filename?: string | null;
  isFavorite?: boolean;
}): Promise<BoardFile> {
  const supabase = createSupabaseServerClient();
  const patch: Partial<BoardFile> = {};

  if (input.tags) {
    patch.tags = input.tags;
  }
  if (input.filename) {
    patch.filename = sanitizeBoardFilename(input.filename);
  }
  if (typeof input.isFavorite === "boolean") {
    patch.is_favorite = input.isFavorite;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("업데이트할 값이 없습니다.");
  }

  const { data, error } = await supabase
    .from("board_files")
    .update(patch)
    .eq("id", input.fileId)
    .eq("owner_id", input.ownerId)
    .select(BOARD_FILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "파일 정보를 업데이트하지 못했습니다.");
  }

  return data as BoardFile;
}

export async function touchBoardFile(input: { fileId: string; ownerId: string }): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("board_files")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", input.fileId)
    .eq("owner_id", input.ownerId);

  if (error) {
    throw new Error(error.message);
  }
}

function isMissingColumnError(message: string | undefined): boolean {
  return /column .* does not exist|Could not find .* column|schema cache/i.test(message ?? "");
}

async function softDeleteBoardFileByBoardFileId(input: {
  fileId: string;
  ownerId: string;
  nowIso: string;
  selectFields: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  code?: string;
}): Promise<DeletedFileReference | null> {
  const supabase = createSupabaseServerClient();
  const firstAttempt = await supabase
    .from("board_files")
    .update(buildSoftDeletePayload({ nowIso: input.nowIso }) as unknown as BoardFileUpdatePayload)
    .eq("id", input.fileId)
    .eq("owner_id", input.ownerId)
    .is("deleted_at", null)
    .select(input.selectFields)
    .maybeSingle();

  if (!firstAttempt.error) {
    if (firstAttempt.data) {
      return normalizeDeletedFileReference(firstAttempt.data);
    }

    const deletedLookup = await supabase
      .from("board_files")
      .select(input.selectFields)
      .eq("id", input.fileId)
      .eq("owner_id", input.ownerId)
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (deletedLookup.error) {
      throw new Error(deletedLookup.error.message);
    }

    return deletedLookup.data ? normalizeDeletedFileReference(deletedLookup.data) : null;
  }

  if (!shouldRetryBoardFileSoftDeleteWithMinimalPayload(firstAttempt.error.message)) {
    throw new Error(firstAttempt.error.message);
  }

  const fallbackAttempt = await supabase
    .from("board_files")
    .update({ deleted_at: input.nowIso })
    .eq("id", input.fileId)
    .eq("owner_id", input.ownerId)
    .is("deleted_at", null)
    .select(input.selectFields)
    .maybeSingle();

  if (fallbackAttempt.error) {
    throw new Error(firstAttempt.error.message);
  }

  console.warn(
    JSON.stringify({
      requestId: input.requestId ?? null,
      fileId: input.fileId,
      ownerId: input.ownerId,
      route: input.route ?? "lib/data/boardFiles",
      method: input.method ?? "UPDATE",
      status: input.status ?? 200,
      code: input.code ?? "SOFT_DELETE_FALLBACK_USED",
      soft_delete_fallback_used: true,
    }),
  );

  return fallbackAttempt.data ? normalizeDeletedFileReference(fallbackAttempt.data) : null;
}

async function resolveBoardFileIdFromFileId(input: {
  fileId: string;
  ownerId: string;
  selectFields: string;
}): Promise<string | null> {
  const supabase = createSupabaseServerClient();

  const activeLookup = await supabase
    .from("board_files")
    .select(input.selectFields)
    .eq("file_id", input.fileId)
    .eq("owner_id", input.ownerId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (activeLookup.error) {
    if (isMissingColumnError(activeLookup.error.message)) {
      return null;
    }
    throw new Error(activeLookup.error.message);
  }

  const activeRow = activeLookup.data as ({ id: string } & Record<string, unknown>) | null;
  if (activeRow?.id) {
    return activeRow.id;
  }

  const deletedLookup = await supabase
    .from("board_files")
    .select(input.selectFields)
    .eq("file_id", input.fileId)
    .eq("owner_id", input.ownerId)
    .not("deleted_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (deletedLookup.error) {
    if (isMissingColumnError(deletedLookup.error.message)) {
      return null;
    }
    throw new Error(deletedLookup.error.message);
  }

  const row = deletedLookup.data as ({ id: string } & Record<string, unknown>) | null;
  return row?.id ?? null;
}

async function resolveBoardFileIdFromCardFileId(input: {
  attachmentId: string;
  ownerId: string;
}): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const lookup = await supabase
    .from("card_files")
    .select("id, board_file_id, board_file:board_file_id (id, owner_id)")
    .eq("id", input.attachmentId)
    .maybeSingle();

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  const row = lookup.data as {
    id: string;
    board_file_id: string;
    board_file: { id: string; owner_id: string } | null;
  } | null;

  if (!row?.board_file || row.board_file.owner_id !== input.ownerId) {
    return null;
  }

  return row.board_file_id;
}

async function markDirectFileRecordDeleted(input: {
  fileId: string;
  ownerId: string;
  nowIso: string;
}): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const update = await supabase
    .from("files")
    .update({ deleted_at: input.nowIso })
    .eq("id", input.fileId)
    .eq("owner_id", input.ownerId)
    .is("deleted_at", null);

  if (update.error) {
    throw new Error(update.error.message);
  }

  return true;
}

async function hasActiveBoardOrCardFileReferences(fileId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const boardFileRefs = await supabase
    .from("board_files")
    .select("id", { count: "exact", head: true })
    .eq("file_id", fileId)
    .is("deleted_at", null);

  if (boardFileRefs.error) {
    if (isMissingColumnError(boardFileRefs.error.message)) {
      return false;
    }
    throw new Error(boardFileRefs.error.message);
  }

  if ((boardFileRefs.count ?? 0) > 0) {
    return true;
  }

  const cardFileRefs = await supabase
    .from("card_files")
    .select("id, board_file:board_file_id!inner(file_id, deleted_at)", { count: "exact", head: true })
    .eq("board_file.file_id", fileId)
    .is("board_file.deleted_at", null);

  if (cardFileRefs.error) {
    if (isMissingColumnError(cardFileRefs.error.message)) {
      return false;
    }
    throw new Error(cardFileRefs.error.message);
  }

  return (cardFileRefs.count ?? 0) > 0;
}

async function markDirectFileRecordDeletedIfUnreferenced(input: {
  fileId: string | null | undefined;
  ownerId: string;
  nowIso: string;
}): Promise<boolean> {
  if (!input.fileId) {
    return false;
  }

  const hasActiveReferences = await hasActiveBoardOrCardFileReferences(input.fileId);
  if (hasActiveReferences) {
    return false;
  }

  return markDirectFileRecordDeleted({
    fileId: input.fileId,
    ownerId: input.ownerId,
    nowIso: input.nowIso,
  });
}

async function softDeleteDirectFileRecord(input: {
  fileId: string;
  ownerId: string;
  nowIso: string;
}): Promise<DeletedFileReference | null> {
  const supabase = createSupabaseServerClient();
  const lookup = await supabase
    .from("files")
    .select("id, filename, r2_key, deleted_at, cards!inner(walls!inner(board_id))")
    .eq("id", input.fileId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  const row = lookup.data as {
    id: string;
    filename: string;
    r2_key: string;
    deleted_at: string | null;
    cards: { walls: { board_id: string } | null } | null;
  } | null;

  if (!row) {
    return null;
  }

  const originalFileDeleted = row.deleted_at ? true : await markDirectFileRecordDeletedIfUnreferenced(input);

  return {
    id: row.id,
    board_id: row.cards?.walls?.board_id ?? "",
    filename: row.filename,
    r2_key: row.r2_key,
    file_id: row.id,
    original_file_deleted: originalFileDeleted,
  };
}

export async function softDeleteBoardFile(
  input: {
    fileId: string;
    ownerId: string;
    requestId?: string;
    route?: string;
    method?: string;
    status?: number;
    code?: string;
  },
): Promise<DeletedFileReference | null> {
  const nowIso = new Date().toISOString();
  const selectFields = "id, board_id, filename, r2_key, deleted_at, file_id";

  const byBoardFileId = await softDeleteBoardFileByBoardFileId({ ...input, nowIso, selectFields });
  if (byBoardFileId) {
    const originalFileDeleted = await markDirectFileRecordDeletedIfUnreferenced({
      fileId: byBoardFileId.file_id,
      ownerId: input.ownerId,
      nowIso,
    });
    return { ...byBoardFileId, original_file_deleted: originalFileDeleted };
  }

  const boardFileIdFromFile = await resolveBoardFileIdFromFileId({
    fileId: input.fileId,
    ownerId: input.ownerId,
    selectFields: "id",
  });
  if (boardFileIdFromFile) {
    const byFileId = await softDeleteBoardFileByBoardFileId({
      ...input,
      fileId: boardFileIdFromFile,
      nowIso,
      selectFields,
    });
    if (byFileId) {
      const originalFileDeleted = await markDirectFileRecordDeletedIfUnreferenced({
        fileId: byFileId.file_id ?? input.fileId,
        ownerId: input.ownerId,
        nowIso,
      });
      return { ...byFileId, original_file_deleted: originalFileDeleted };
    }
  }

  const boardFileIdFromAttachment = await resolveBoardFileIdFromCardFileId({
    attachmentId: input.fileId,
    ownerId: input.ownerId,
  });
  if (boardFileIdFromAttachment) {
    const byAttachmentId = await softDeleteBoardFileByBoardFileId({
      ...input,
      fileId: boardFileIdFromAttachment,
      nowIso,
      selectFields,
    });
    if (byAttachmentId) {
      const originalFileDeleted = await markDirectFileRecordDeletedIfUnreferenced({
        fileId: byAttachmentId.file_id,
        ownerId: input.ownerId,
        nowIso,
      });
      return { ...byAttachmentId, original_file_deleted: originalFileDeleted };
    }
  }

  return softDeleteDirectFileRecord({
    fileId: input.fileId,
    ownerId: input.ownerId,
    nowIso,
  });
}
