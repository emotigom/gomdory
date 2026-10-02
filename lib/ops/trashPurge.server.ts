import "server-only";

import { requireOpsAdmin, type OpsAuthenticatedUser } from "@/lib/auth/requireOpsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { TRASH_PURGE_DB_COLUMNS } from "@/lib/db/trashPurge";
import { deleteObject } from "@/lib/r2/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 50;

type PurgeType = "board" | "card" | "boardFile" | "file";

export type PurgeCandidate = {
  type: PurgeType;
  id: string;
  deletedAt: string | null;
  deletedPurgeAt: string | null;
  storageKey?: string | null;
};

export type PurgeSummary = {
  dryRun: boolean;
  scanned: number;
  purged: number;
  failed: number;
};

type PurgeDeps = {
  createAdminClientFn?: typeof createSupabaseAdminClient;
  deleteObjectFn?: typeof deleteObject;
  logAuditFn?: typeof logAudit;
  requireOpsAdminFn?: typeof requireOpsAdmin;
};

const TABLE_BY_TYPE: Record<PurgeType, "boards" | "cards" | "board_files" | "files"> = {
  board: "boards",
  card: "cards",
  boardFile: "board_files",
  file: "files",
};

function normalizeLimit(limit?: number): number {
  const raw = Number.isFinite(limit) ? Math.floor(limit as number) : DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 1), DEFAULT_LIMIT);
}

async function ensureOps(deps?: PurgeDeps): Promise<OpsAuthenticatedUser> {
  const ensure = deps?.requireOpsAdminFn ?? requireOpsAdmin;
  const auth = await ensure(requireUserApi);
  return auth.user;
}

export async function listPurgeCandidates(limit = DEFAULT_LIMIT, now = new Date(), deps?: PurgeDeps): Promise<PurgeCandidate[]> {
  const admin = (deps?.createAdminClientFn ?? createSupabaseAdminClient)();
  const cap = normalizeLimit(limit);
  const nowIso = now.toISOString();

  const [boardsRaw, cardsRaw, boardFilesRaw, filesRaw] = await Promise.all([
    admin
      .from("boards" as never)
      .select(`id, ${TRASH_PURGE_DB_COLUMNS.deletedAt}, ${TRASH_PURGE_DB_COLUMNS.deletedPurgeAt}`)
      .not(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, "is", null)
      .lte(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, nowIso)
      .order(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, { ascending: true })
      .limit(cap),
    admin
      .from("cards" as never)
      .select(`id, ${TRASH_PURGE_DB_COLUMNS.deletedAt}, ${TRASH_PURGE_DB_COLUMNS.deletedPurgeAt}`)
      .not(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, "is", null)
      .lte(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, nowIso)
      .order(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, { ascending: true })
      .limit(cap),
    admin
      .from("board_files" as never)
      .select(`id, ${TRASH_PURGE_DB_COLUMNS.deletedAt}, ${TRASH_PURGE_DB_COLUMNS.deletedPurgeAt}, ${TRASH_PURGE_DB_COLUMNS.r2Key}`)
      .not(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, "is", null)
      .lte(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, nowIso)
      .order(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, { ascending: true })
      .limit(cap),
    admin
      .from("files" as never)
      .select(`id, ${TRASH_PURGE_DB_COLUMNS.deletedAt}, ${TRASH_PURGE_DB_COLUMNS.deletedPurgeAt}, ${TRASH_PURGE_DB_COLUMNS.r2Key}`)
      .not(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, "is", null)
      .lte(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, nowIso)
      .order(TRASH_PURGE_DB_COLUMNS.deletedPurgeAt, { ascending: true })
      .limit(cap),
  ]);

  const toRows = <T,>(rows: T[] | null | undefined) => rows ?? [];

  const boards = toRows(boardsRaw.data as Array<{ id: string; deleted_at: string | null; deleted_purge_at: string | null }>).map((row) => ({
    type: "board" as const,
    id: row.id,
    deletedAt: row.deleted_at,
    deletedPurgeAt: row.deleted_purge_at,
  }));

  const cards = toRows(cardsRaw.data as Array<{ id: string; deleted_at: string | null; deleted_purge_at: string | null }>).map((row) => ({
    type: "card" as const,
    id: row.id,
    deletedAt: row.deleted_at,
    deletedPurgeAt: row.deleted_purge_at,
  }));

  const boardFiles = toRows(
    boardFilesRaw.data as Array<{ id: string; deleted_at: string | null; deleted_purge_at: string | null; r2_key: string | null }>,
  ).map((row) => ({
    type: "boardFile" as const,
    id: row.id,
    deletedAt: row.deleted_at,
    deletedPurgeAt: row.deleted_purge_at,
    storageKey: row.r2_key,
  }));

  const files = toRows(filesRaw.data as Array<{ id: string; deleted_at: string | null; deleted_purge_at: string | null; r2_key: string | null }>).map((row) => ({
    type: "file" as const,
    id: row.id,
    deletedAt: row.deleted_at,
    deletedPurgeAt: row.deleted_purge_at,
    storageKey: row.r2_key,
  }));

  return [...boards, ...cards, ...boardFiles, ...files]
    .sort((a, b) => (a.deletedPurgeAt ?? "").localeCompare(b.deletedPurgeAt ?? ""))
    .slice(0, cap);
}

export async function purgeOne(candidate: Pick<PurgeCandidate, "type" | "id"> & { storageKey?: string | null }, deps?: PurgeDeps): Promise<{ ok: boolean }> {
  const admin = (deps?.createAdminClientFn ?? createSupabaseAdminClient)();
  const removeObject = deps?.deleteObjectFn ?? deleteObject;
  const audit = deps?.logAuditFn ?? logAudit;

  await audit({
    action: "purge_started",
    targetType: candidate.type,
    targetId: candidate.id,
    meta: { purgeType: candidate.type },
  });

  try {
    const table = TABLE_BY_TYPE[candidate.type];
    const { error } = await admin.from(table as never).delete().eq("id", candidate.id);
    if (error) {
      throw new Error(error.message);
    }

    if (candidate.storageKey) {
      try {
        await removeObject(candidate.storageKey);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "warn",
            action: "purge_r2_delete_failed",
            targetType: candidate.type,
            targetId: candidate.id,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    await audit({
      action: "purge_succeeded",
      targetType: candidate.type,
      targetId: candidate.id,
      meta: { purgeType: candidate.type },
    });

    return { ok: true };
  } catch (error) {
    await audit({
      action: "purge_failed",
      targetType: candidate.type,
      targetId: candidate.id,
      meta: {
        purgeType: candidate.type,
        message: error instanceof Error ? error.message : String(error),
      },
    });

    return { ok: false };
  }
}

export async function runTrashPurge(input: { dryRun: boolean; limit?: number; now?: Date }, deps?: PurgeDeps): Promise<PurgeSummary> {
  await ensureOps(deps);

  const candidates = await listPurgeCandidates(input.limit ?? DEFAULT_LIMIT, input.now ?? new Date(), deps);

  if (input.dryRun) {
    return { dryRun: true, scanned: candidates.length, purged: 0, failed: 0 };
  }

  let purged = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const result = await purgeOne(candidate, deps);
    if (result.ok) purged += 1;
    else failed += 1;
  }

  return {
    dryRun: false,
    scanned: candidates.length,
    purged,
    failed,
  };
}
