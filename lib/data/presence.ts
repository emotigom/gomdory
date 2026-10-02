import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DISPLAY_NAME_LIMIT = 12;
const USER_AGENT_LIMIT = 180;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const MULTI_SPACE_REGEX = /\s+/g;
const ALLOWED_CHAR_REGEX = /[\p{L}\p{N}\s._\-!@#&*+?]/u;

export type PresenceParticipant = {
  displayName: string | null;
  lastSeenAt: string;
  joinedAt: string;
  fingerprint: string;
};

export type PresenceSummary = {
  activeCount: number;
  active: PresenceParticipant[];
  recentJoinsCount: number;
};

export function normalizeDisplayName(input?: string | null): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.replace(ZERO_WIDTH_REGEX, "").replace(MULTI_SPACE_REGEX, " ").trim();
  if (!trimmed) return null;

  const filtered = Array.from(trimmed)
    .filter((char) => ALLOWED_CHAR_REGEX.test(char))
    .join("")
    .replace(MULTI_SPACE_REGEX, " ")
    .trim();

  if (!filtered) return null;

  const sliced = Array.from(filtered).slice(0, DISPLAY_NAME_LIMIT).join("");
  return sliced.length > 0 ? sliced : null;
}

export function normalizeUserAgent(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > USER_AGENT_LIMIT) return trimmed.slice(0, USER_AGENT_LIMIT);
  return trimmed;
}

export function buildAnonymousName(fingerprint: string) {
  const suffixSource = fingerprint.slice(-6);
  const suffix = Number.parseInt(suffixSource, 16);
  const number = Number.isFinite(suffix) ? (suffix % 900) + 100 : 100;
  return `익명 ${number}`;
}

export function isWithinActiveWindow(lastSeenAt: string | Date, nowMs: number, windowSeconds: number) {
  const lastMs = typeof lastSeenAt === "string" ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  return nowMs - lastMs <= windowSeconds * 1000;
}

export async function upsertParticipant(input: {
  boardId: string;
  shareCode: string;
  fingerprint: string;
  displayName?: string | null;
  userAgent?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const payload: {
    board_id: string;
    share_code: string;
    fingerprint: string;
    last_seen_at: string;
    display_name?: string | null;
    user_agent?: string | null;
  } = {
    board_id: input.boardId,
    share_code: input.shareCode,
    fingerprint: input.fingerprint,
    last_seen_at: nowIso,
  };

  if (input.displayName !== undefined) {
    payload.display_name = input.displayName;
  }

  if (input.userAgent) {
    payload.user_agent = input.userAgent;
  }

  const { data, error } = await supabase
    .from("live_participants")
    .upsert(payload, { onConflict: "board_id,share_code,fingerprint" })
    .select("display_name,last_seen_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    displayName: (data?.display_name as string | null) ?? input.displayName ?? null,
    lastSeenAt: (data?.last_seen_at as string | null) ?? nowIso,
  };
}

export async function pruneOldParticipants(input: {
  boardId: string;
  shareCode: string;
  ttlSeconds: number;
}) {
  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - input.ttlSeconds * 1000).toISOString();
  const { error } = await supabase
    .from("live_participants")
    .delete()
    .eq("board_id", input.boardId)
    .eq("share_code", input.shareCode)
    .lt("last_seen_at", cutoff);

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetParticipants(input: { boardId: string; shareCode: string }) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("live_participants")
    .delete()
    .eq("board_id", input.boardId)
    .eq("share_code", input.shareCode);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPresenceSummary(input: {
  boardId: string;
  shareCode: string;
  activeWithinSeconds: number;
  limit?: number;
}): Promise<PresenceSummary> {
  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const cutoff = new Date(now - input.activeWithinSeconds * 1000).toISOString();
  const { data, error, count } = await supabase
    .from("live_participants")
    .select("display_name,last_seen_at,joined_at,fingerprint", { count: "exact" })
    .eq("board_id", input.boardId)
    .eq("share_code", input.shareCode)
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    display_name: string | null;
    last_seen_at: string;
    joined_at: string;
    fingerprint: string;
  }>;

  return {
    activeCount: count ?? rows.length,
    active: rows.map((row) => ({
      displayName: row.display_name ?? null,
      lastSeenAt: row.last_seen_at,
      joinedAt: row.joined_at,
      fingerprint: row.fingerprint,
    })),
    recentJoinsCount: rows.filter((row) => isWithinActiveWindow(row.joined_at, now, input.activeWithinSeconds)).length,
  };
}
