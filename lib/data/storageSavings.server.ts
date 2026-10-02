import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SavingsTotals = {
  totalSavedBytes: number;
  savedThisMonthBytes: number;
};

function monthStartIso(now: Date): string {
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  return start.toISOString();
}

function calculateFileSavings(input: {
  originalBytes: number | null;
  storedBytes: number | null;
  deduped: boolean;
}): number {
  const stored = Number.isFinite(input.storedBytes) && input.storedBytes ? input.storedBytes : 0;
  const original = Number.isFinite(input.originalBytes) && input.originalBytes ? input.originalBytes : stored;
  const optimizedSaved = Math.max(0, original - stored);
  const dedupSaved = input.deduped ? stored : 0;
  return optimizedSaved + dedupSaved;
}

export async function getStorageSavingsForOwner(ownerId: string): Promise<SavingsTotals> {
  const supabase = createSupabaseAdminClient();
  const monthStart = monthStartIso(new Date());

  const [{ data: files, error: filesError }, { data: boardFiles, error: boardFilesError }] = await Promise.all([
    supabase
      .from("files")
      .select("original_bytes, stored_bytes, deduped, created_at, status")
      .eq("owner_id", ownerId)
      .eq("status", "ready"),
    supabase
      .from("board_files")
      .select("original_bytes, optimized_bytes, bytes_saved, created_at, deleted_at")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
  ]);

  if (filesError) {
    throw new Error(filesError.message);
  }
  if (boardFilesError) {
    throw new Error(boardFilesError.message);
  }

  let totalSavedBytes = 0;
  let savedThisMonthBytes = 0;

  for (const file of files ?? []) {
    const saved = calculateFileSavings({
      originalBytes: file.original_bytes ?? null,
      storedBytes: file.stored_bytes ?? null,
      deduped: Boolean(file.deduped),
    });
    totalSavedBytes += saved;
    if (file.created_at && file.created_at >= monthStart) {
      savedThisMonthBytes += saved;
    }
  }

  for (const file of boardFiles ?? []) {
    const saved =
      typeof file.bytes_saved === "number"
        ? file.bytes_saved
        : Math.max(0, (file.original_bytes ?? 0) - (file.optimized_bytes ?? 0));
    totalSavedBytes += saved;
    if (file.created_at && file.created_at >= monthStart) {
      savedThisMonthBytes += saved;
    }
  }

  return {
    totalSavedBytes,
    savedThisMonthBytes,
  };
}
