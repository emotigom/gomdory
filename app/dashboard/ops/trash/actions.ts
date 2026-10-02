"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { logAudit } from "@/lib/data/audit";
import { buildRestorePayload, SOFT_DELETE_DB_COLUMNS } from "@/lib/db/softDelete";
import { runTrashPurge } from "@/lib/ops/trashPurge.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";

type TrashTab = "boards" | "cards" | "files";

type DeletedItem = {
  id: string;
  title: string;
  deletedAt: string;
  deletedPurgeAt: string | null;
  boardId?: string | null;
};

export type TrashSnapshot = {
  boards: DeletedItem[];
  cards: DeletedItem[];
  files: DeletedItem[];
  warnings: string[];
};

type Deps = {
  requireUserFn?: typeof requireUser;
  isOpsAdminFn?: typeof isOpsAdmin;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

type CardUpdatePayload = Database["public"]["Tables"]["cards"]["Update"];

async function ensureOpsAdmin(deps?: Deps) {
  const requireUserFn = deps?.requireUserFn ?? requireUser;
  const isOpsAdminFn = deps?.isOpsAdminFn ?? isOpsAdmin;
  const { user } = await requireUserFn("/dashboard/ops/trash");
  if (!isOpsAdminFn(user.email)) {
    throw new Error("ops_only");
  }
  return user;
}

export async function getTrashSnapshot(deps?: Deps): Promise<TrashSnapshot> {
  await ensureOpsAdmin(deps);
  const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
  const warnings: string[] = [];

  const [boardsRaw, cardsRaw, filesRaw] = await Promise.all([
    admin
      .from("boards" as never)
      .select("id, title, deleted_at, deleted_purge_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    admin
      .from("cards" as never)
      .select("id, text, deleted_at, deleted_purge_at, walls(board_id)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    admin
      .from("board_files" as never)
      .select("id, filename, deleted_at, deleted_purge_at, board_id")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
  ]);

  if (boardsRaw.error) warnings.push(`boards: ${boardsRaw.error.message}`);
  if (cardsRaw.error) warnings.push(`cards: ${cardsRaw.error.message}`);
  if (filesRaw.error) warnings.push(`files: ${filesRaw.error.message}`);

  const boardRows = (boardsRaw.data ?? []) as Array<{ id: string; title: string | null; deleted_at: string | null; deleted_purge_at: string | null }>;
  const cardRows = (cardsRaw.data ?? []) as Array<{
    id: string;
    text: string | null;
    deleted_at: string | null;
    deleted_purge_at: string | null;
    walls: { board_id?: string } | null;
  }>;
  const fileRows = (filesRaw.data ?? []) as Array<{
    id: string;
    filename: string | null;
    deleted_at: string | null;
    deleted_purge_at: string | null;
    board_id: string | null;
  }>;

  return {
    boards: boardRows.map((row) => ({ id: row.id, title: row.title ?? "(untitled)", deletedAt: row.deleted_at ?? "", deletedPurgeAt: row.deleted_purge_at })),
    cards: cardRows.map((row) => ({
      id: row.id,
      title: row.text ? row.text.slice(0, 80) : "(empty card)",
      deletedAt: row.deleted_at ?? "",
      deletedPurgeAt: row.deleted_purge_at,
      boardId: (row.walls as { board_id?: string } | null)?.board_id ?? null,
    })),
    files: fileRows.map((row) => ({
      id: row.id,
      title: row.filename ?? "(unnamed file)",
      deletedAt: row.deleted_at ?? "",
      deletedPurgeAt: row.deleted_purge_at,
      boardId: row.board_id ?? null,
    })),
    warnings,
  };
}

export async function runOpsTrashPurgeAction(input: { dryRun: boolean }): Promise<{ ok: boolean; scanned: number; purged: number; failed: number; error?: string }> {
  try {
    await ensureOpsAdmin();
    const summary = await runTrashPurge({ dryRun: input.dryRun });
    revalidatePath("/dashboard/ops/trash");
    return { ok: true, scanned: summary.scanned, purged: summary.purged, failed: summary.failed };
  } catch (error) {
    return {
      ok: false,
      scanned: 0,
      purged: 0,
      failed: 0,
      error: error instanceof Error ? error.message : "purge_failed",
    };
  }
}

export async function restoreTrashItem(input: { tab: TrashTab; id: string }, deps?: Deps): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await ensureOpsAdmin(deps);
    const admin = (deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
    const nowIso = new Date().toISOString();

    if (input.tab === "boards") {
      const { data, error } = await admin
        .from("boards" as never)
        .update({ deleted_at: null, deleted_purge_at: null } as never)
        .eq("id", input.id)
        .not(SOFT_DELETE_DB_COLUMNS.deletedAt, "is", null)
        .select("id");
      if (error || !data?.length) {
        return { ok: false, error: error?.message ?? "restore_failed" };
      }
      await logAudit({ action: "board.restored", targetType: "board", targetId: input.id, boardId: input.id, meta: { actorUserId: user.id } });
    }

    if (input.tab === "cards") {
      const { data, error } = await admin
        .from("cards")
        .update(buildRestorePayload(nowIso) as CardUpdatePayload)
        .eq("id", input.id)
        .not(SOFT_DELETE_DB_COLUMNS.deletedAt, "is", null)
        .select("id, wall_id, walls(board_id)")
        .maybeSingle();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "restore_failed" };
      }
      const boardId = (data.walls as { board_id?: string } | null)?.board_id ?? null;
      await logAudit({ action: "card.restored", targetType: "card", targetId: input.id, boardId, meta: { actorUserId: user.id } });
    }

    if (input.tab === "files") {
      const { data, error } = await admin
        .from("board_files" as never)
        .update({ deleted_at: null, deleted_purge_at: null } as never)
        .eq("id", input.id)
        .not(SOFT_DELETE_DB_COLUMNS.deletedAt, "is", null)
        .select("id, board_id")
        .maybeSingle();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "restore_failed" };
      }
      const restoredFile = data as { board_id?: string | null };
      await logAudit({ action: "file.restored", targetType: "file", targetId: input.id, boardId: restoredFile.board_id ?? null, meta: { actorUserId: user.id } });
    }

    revalidatePath("/dashboard/ops/trash");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "restore_failed" };
  }
}
