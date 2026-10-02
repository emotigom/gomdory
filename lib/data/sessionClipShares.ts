import "server-only";

import { base64UrlEncode } from "@/lib/crypto/webcrypto";
import { buildClipUrl } from "@/lib/http/publicLinks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ClipShareMode = "safe" | "full";

export type ClipShareRow = {
  token: string;
  clip_start_ts: string;
  clip_end_ts: string;
  mode: ClipShareMode;
  title: string | null;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
};

export type CreateClipShareInput = {
  boardId: string;
  sessionId: string;
  startTs: string | number;
  endTs: string | number;
  mode?: ClipShareMode;
  title?: string | null;
  expiresInDays?: number | null;
};

export type CreateClipShareResult = {
  token: string;
  url: string;
  qrPayload: string;
  share: ClipShareRow;
};

const MAX_DURATION_SECONDS = 20 * 60;
const TOKEN_BYTE_LENGTH = 32;
const ALLOWED_EXPIRY_DAYS = new Set([7, 30]);

const RANGE_ERROR_MESSAGE: Record<string, string> = {
  range_parse: "클립 범위를 읽지 못했습니다.",
  range_invalid: "클립 범위가 올바르지 않습니다.",
  range_too_long: "클립은 최대 20분까지 가능합니다.",
};

type ClipRangeValidationError = {
  ok: false;
  code: "range_parse" | "range_invalid" | "range_too_long";
  message: string;
};

function maskToken(token: string) {
  if (token.length <= 8) return `${token.slice(0, 2)}…${token.slice(-2)}`;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function createRangeError(code: ClipRangeValidationError["code"]): ClipRangeValidationError {
  const message = RANGE_ERROR_MESSAGE[code] ?? "클립 범위가 올바르지 않습니다.";
  return { ok: false, code, message };
}

function parseTimestamp(value: string | number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function createToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function validateRange(startTs: string | number, endTs: string | number): { startMs: number; endMs: number } {
  const startMs = parseTimestamp(startTs);
  const endMs = parseTimestamp(endTs);
  if (startMs === null || endMs === null) {
    throw createRangeError("range_parse");
  }
  const durationSeconds = (endMs - startMs) / 1000;
  if (durationSeconds <= 0) {
    throw createRangeError("range_invalid");
  }
  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw createRangeError("range_too_long");
  }
  return { startMs, endMs };
}

function resolveExpiry(expiresInDays: number | null | undefined): string | null {
  if (expiresInDays === null || expiresInDays === undefined) {
    return null;
  }
  if (!ALLOWED_EXPIRY_DAYS.has(expiresInDays)) {
    throw new Error("expires_invalid");
  }
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
}

export function normalizeExpiresInDays(expiresInDays: number | null | undefined): number | null | undefined {
  if (expiresInDays === undefined || expiresInDays === null) {
    return expiresInDays;
  }
  if (!ALLOWED_EXPIRY_DAYS.has(expiresInDays)) {
    throw new Error("expires_invalid");
  }
  return expiresInDays;
}

export async function createClipShare(input: CreateClipShareInput): Promise<CreateClipShareResult> {
  const { startMs, endMs } = validateRange(input.startTs, input.endTs);
  const normalizedExpires = normalizeExpiresInDays(input.expiresInDays);
  const expiresAtInput = normalizedExpires === undefined ? 7 : normalizedExpires;
  const expires_at = resolveExpiry(expiresAtInput);
  const token = createToken();
  const mode: ClipShareMode = input.mode ?? "safe";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_session_clip_shares")
    .insert({
      board_id: input.boardId,
      session_id: input.sessionId,
      token,
      clip_start_ts: new Date(startMs).toISOString(),
      clip_end_ts: new Date(endMs).toISOString(),
      mode,
      title: input.title ?? null,
      expires_at,
    })
    .select("token, clip_start_ts, clip_end_ts, mode, title, created_at, revoked_at, expires_at")
    .single();

  if (error || !data) {
    const masked = maskToken(token);
    throw new Error(`clip_share_create_failed:${masked}`);
  }

  const url = buildClipUrl(token);

  return {
    token,
    url,
    qrPayload: url,
    share: data as ClipShareRow,
  };
}

export async function revokeClipShare({
  boardId,
  sessionId,
  token,
}: {
  boardId: string;
  sessionId: string;
  token: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("class_session_clip_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("board_id", boardId)
    .eq("session_id", sessionId)
    .eq("token", token)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listClipShares(sessionId: string): Promise<ClipShareRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_session_clip_shares")
    .select("token, clip_start_ts, clip_end_ts, mode, title, created_at, revoked_at, expires_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClipShareRow[];
}

export type ClipShareLookup = ClipShareRow & { board_id: string; session_id: string };

export async function getClipShareByToken(token: string): Promise<ClipShareLookup | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_session_clip_shares")
    .select("token, board_id, session_id, clip_start_ts, clip_end_ts, mode, title, created_at, revoked_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const share = (data as ClipShareLookup | null) ?? null;
  if (!share) return null;
  if (share.revoked_at) return null;
  if (share.expires_at) {
    const expiresAt = Date.parse(share.expires_at);
    if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
      return null;
    }
  }

  return share;
}

export function isExpiresValidationError(error: unknown): boolean {
  return error instanceof Error && error.message === "expires_invalid";
}

export function isRangeValidationError(error: unknown): error is ClipRangeValidationError {
  return Boolean(error && typeof error === "object" && (error as ClipRangeValidationError).ok === false);
}
