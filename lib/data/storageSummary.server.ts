import "server-only";

import { computeStorageSummary, type StorageRecord, type StorageSummary } from "./storageSummary";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CACHE_TTL_MS = 60_000;
const summaryCache = new Map<string, { createdAt: number; summary: StorageSummary }>();

function readCache(ownerId: string): StorageSummary | null {
  const entry = summaryCache.get(ownerId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    summaryCache.delete(ownerId);
    return null;
  }
  return entry.summary;
}

function writeCache(ownerId: string, summary: StorageSummary) {
  summaryCache.set(ownerId, { createdAt: Date.now(), summary });
}

export async function fetchStorageRecordsForOwner(ownerId: string): Promise<StorageRecord[]> {
  const supabase = createSupabaseAdminClient();

  const { data: boards, error: boardsError } = await supabase
    .from("boards")
    .select("id, title, class_id")
    .eq("owner_id", ownerId);

  if (boardsError) {
    throw new Error(boardsError.message);
  }

  const boardMap = new Map<string, { title: string; classId: string | null }>();
  for (const board of boards ?? []) {
    boardMap.set(board.id, { title: board.title, classId: board.class_id });
  }

  const classIds = Array.from(new Set((boards ?? []).map((board) => board.class_id).filter(Boolean))) as string[];
  const classMap = new Map<string, { title: string }>();

  if (classIds.length > 0) {
    const { data: classes, error: classError } = await supabase
      .from("classes")
      .select("id, title")
      .in("id", classIds);

    if (classError) {
      throw new Error(classError.message);
    }

    for (const entry of classes ?? []) {
      classMap.set(entry.id, { title: entry.title });
    }
  }

  const boardIds = Array.from(boardMap.keys());
  const wallMap = new Map<string, string>();

  if (boardIds.length > 0) {
    const { data: walls, error: wallError } = await supabase
      .from("walls")
      .select("id, board_id")
      .in("board_id", boardIds);

    if (wallError) {
      throw new Error(wallError.message);
    }

    for (const wall of walls ?? []) {
      wallMap.set(wall.id, wall.board_id);
    }
  }

  const wallIds = Array.from(wallMap.keys());
  const cardMap = new Map<string, string>();

  if (wallIds.length > 0) {
    const { data: cards, error: cardError } = await supabase
      .from("cards")
      .select("id, wall_id")
      .in("wall_id", wallIds);

    if (cardError) {
      throw new Error(cardError.message);
    }

    for (const card of cards ?? []) {
      const boardId = wallMap.get(card.wall_id);
      if (boardId) {
        cardMap.set(card.id, boardId);
      }
    }
  }

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("id, card_id, filename, content_type, size_bytes, stored_bytes, original_bytes, deduped, created_at, status")
    .eq("owner_id", ownerId)
    .eq("status", "ready");

  if (filesError) {
    throw new Error(filesError.message);
  }

  const records: StorageRecord[] = (files ?? []).map((file) => {
    const boardId = cardMap.get(file.card_id) ?? null;
    const board = boardId ? boardMap.get(boardId) : undefined;
    const classId = board?.classId ?? null;
    const classInfo = classId ? classMap.get(classId) : undefined;
    const storedBytes = file.stored_bytes ?? file.size_bytes ?? 0;
    const originalBytes = file.original_bytes ?? storedBytes;
    const deduped = Boolean(file.deduped);
    const bytesSaved = Math.max(0, originalBytes - storedBytes) + (deduped ? storedBytes : 0);

    return {
      id: file.id,
      name: file.filename,
      bytes: storedBytes,
      mime: file.content_type ?? null,
      boardId,
      boardTitle: board?.title ?? null,
      classId,
      classTitle: classInfo?.title ?? null,
      createdAt: file.created_at ?? null,
      lastAccessedAt: null,
      originalBytes,
      optimizedBytes: storedBytes,
      bytesSaved,
    } satisfies StorageRecord;
  });

  const { data: boardFiles, error: boardFilesError } = await supabase
    .from("board_files")
    .select("id, board_id, filename, bytes, mime, created_at, original_bytes, optimized_bytes, bytes_saved")
    .eq("owner_id", ownerId)
    .is("deleted_at", null);

  if (boardFilesError) {
    throw new Error(boardFilesError.message);
  }

  for (const file of boardFiles ?? []) {
    const boardId = file.board_id ?? null;
    const board = boardId ? boardMap.get(boardId) : undefined;
    const classId = board?.classId ?? null;
    const classInfo = classId ? classMap.get(classId) : undefined;

    records.push({
      id: file.id,
      name: file.filename ?? "파일",
      bytes: file.optimized_bytes ?? file.bytes ?? 0,
      mime: file.mime ?? null,
      boardId,
      boardTitle: board?.title ?? null,
      classId,
      classTitle: classInfo?.title ?? null,
      createdAt: file.created_at ?? null,
      lastAccessedAt: null,
      originalBytes: file.original_bytes ?? null,
      optimizedBytes: file.optimized_bytes ?? file.bytes ?? null,
      bytesSaved: file.bytes_saved ?? null,
    });
  }

  return records;
}

export async function getStorageSummaryForOwner(ownerId: string): Promise<StorageSummary> {
  const cached = readCache(ownerId);
  if (cached) {
    return cached;
  }

  const records = await fetchStorageRecordsForOwner(ownerId);
  const summary = computeStorageSummary(records);
  writeCache(ownerId, summary);
  return summary;
}
