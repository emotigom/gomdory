import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertBoardLiveSession, getBoardIdByShareCode } from "@/lib/data/liveSession";

export type PulseKind = "ok" | "unsure" | "help";

export type PulseCounts = {
  ok: number;
  unsure: number;
  help: number;
  updatedAt: number;
};

const PULSE_THROTTLE_MS = 3000;

export class PulseError extends Error {
  status: number;
  code: "RATE_LIMIT" | "INVALID_KIND" | "NOT_FOUND";

  constructor(code: "RATE_LIMIT" | "INVALID_KIND" | "NOT_FOUND", message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function normalizePulseKind(kind: unknown): PulseKind {
  if (kind === "ok" || kind === "unsure" || kind === "help") return kind;
  throw new PulseError("INVALID_KIND", "알 수 없는 응답이에요.", 400);
}

export async function throttlePulse(shareCode: string, fingerprint: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pulse_events")
    .select("created_at")
    .eq("share_code", shareCode)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const now = Date.now();
  const lastSubmitAt = data?.created_at ? new Date(data.created_at).getTime() : null;

  if (lastSubmitAt && now - lastSubmitAt < PULSE_THROTTLE_MS) {
    throw new PulseError("RATE_LIMIT", "잠시 후에 다시 시도해주세요.", 429);
  }
}

export async function upsertPulse(shareCode: string, fingerprint: string, kind: PulseKind) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("pulse_events")
    .upsert(
      {
        share_code: shareCode,
        fingerprint,
        kind,
        created_at: new Date().toISOString(),
      },
      { onConflict: "share_code,fingerprint" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPulseCounts(shareCode: string): Promise<PulseCounts> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pulse_events")
    .select("kind, created_at")
    .eq("share_code", shareCode);

  if (error) {
    throw new Error(error.message);
  }

  let ok = 0;
  let unsure = 0;
  let help = 0;
  let updatedAt = 0;

  for (const row of data ?? []) {
    if (row.kind === "ok") ok += 1;
    else if (row.kind === "unsure") unsure += 1;
    else if (row.kind === "help") help += 1;

    const createdAt = row.created_at ? new Date(row.created_at as string).getTime() : null;
    if (createdAt && createdAt > updatedAt) {
      updatedAt = createdAt;
    }
  }

  if (!updatedAt) {
    updatedAt = Date.now();
  }

  return { ok, unsure, help, updatedAt };
}

export async function updateLivePulseSnapshot(shareCode: string) {
  const boardId = await getBoardIdByShareCode(shareCode);
  if (!boardId) {
    throw new PulseError("NOT_FOUND", "보드를 찾을 수 없어요.", 404);
  }

  const counts = await getPulseCounts(shareCode);
  await upsertBoardLiveSession(boardId, {
    pulse: counts,
    ts: Date.now(),
  }, { useServiceRole: true });
  return counts;
}

export async function resetPulse(shareCode: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("pulse_events").delete().eq("share_code", shareCode);
  const counts: PulseCounts = { ok: 0, unsure: 0, help: 0, updatedAt: Date.now() };
  const boardId = await getBoardIdByShareCode(shareCode);
  if (boardId) {
    await upsertBoardLiveSession(boardId, { pulse: counts, ts: Date.now() }, { useServiceRole: true });
  }
  return counts;
}
