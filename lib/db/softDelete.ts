import { toSnakeKeys } from "@/lib/standards/fields";
import { computeDeletedPurgeAt } from "@/lib/db/trashPurge";

export const SOFT_DELETE_DB_COLUMNS = {
  deletedAt: "deleted_at",
} as const;

export function buildSoftDeletePayload(input: { nowIso: string; deletedBy?: string | null }): Record<string, unknown> {
  return toSnakeKeys({
    deletedAt: input.nowIso,
    deletedPurgeAt: computeDeletedPurgeAt(input.nowIso),
    updatedAt: input.nowIso,
    deletedBy: input.deletedBy ?? null,
  });
}

export function buildRestorePayload(nowIso: string): Record<string, unknown> {
  return toSnakeKeys({
    deletedAt: null,
    deletedPurgeAt: null,
    deletedBy: null,
    deleteReason: null,
    updatedAt: nowIso,
  });
}
