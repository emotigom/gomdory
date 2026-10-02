export const TRASH_PURGE_DB_COLUMNS = {
  deletedAt: "deleted_at",
  deletedPurgeAt: "deleted_purge_at",
  boardId: "board_id",
  r2Key: "r2_key",
} as const;

export const TRASH_PURGE_TTL_DAYS = 30;

export function computeDeletedPurgeAt(deletedAtIso: string, ttlDays = TRASH_PURGE_TTL_DAYS): string {
  const base = new Date(deletedAtIso);
  const millis = ttlDays * 24 * 60 * 60 * 1000;
  return new Date(base.getTime() + millis).toISOString();
}
