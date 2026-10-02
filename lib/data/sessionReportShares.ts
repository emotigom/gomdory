import "server-only";

import { digestHex, randomHex } from "@/lib/crypto/webcrypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionReportShareRow = {
  token: string;
  board_id: string;
  session_id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

const REPORT_SHARE_TOKEN_BYTES = 32;
const REPORT_SHARE_TOKEN_REGEX = /^[a-f0-9]{64,96}$/i;
const DEFAULT_EXPIRY_DAYS = 30;

export function generateReportShareToken(byteLength = REPORT_SHARE_TOKEN_BYTES): string {
  return randomHex(byteLength);
}

export function isValidReportShareToken(token: string): boolean {
  return REPORT_SHARE_TOKEN_REGEX.test(token);
}

export function isReportShareActive(
  share: Pick<SessionReportShareRow, "expires_at" | "revoked_at"> | null,
  now = Date.now(),
): boolean {
  if (!share || share.revoked_at) return false;
  if (!share.expires_at) return true;
  const expiry = Date.parse(share.expires_at);
  if (Number.isNaN(expiry)) return false;
  return expiry > now;
}

export async function hashReportShareToken(token: string): Promise<string> {
  return digestHex("SHA-256", token);
}

export function maskReportShareToken(token: string): string {
  if (!token || token.length < 6) return "";
  return `${token.slice(0, 6).toUpperCase()}••••`;
}

function defaultExpiryIso() {
  return new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function getActiveReportShare({
  boardId,
  sessionId,
}: {
  boardId: string;
  sessionId: string;
}): Promise<SessionReportShareRow | null> {
  const supabase = createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("session_report_shares")
    .select("token, board_id, session_id, created_at, expires_at, revoked_at")
    .eq("board_id", boardId)
    .eq("session_id", sessionId)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SessionReportShareRow | null) ?? null;
}

export async function createReportShare({
  boardId,
  sessionId,
  expiresAt,
}: {
  boardId: string;
  sessionId: string;
  expiresAt?: string | null;
}): Promise<SessionReportShareRow> {
  const supabase = createSupabaseServerClient();
  const token = generateReportShareToken();
  const expires_at = expiresAt ?? defaultExpiryIso();

  const { data, error } = await supabase
    .from("session_report_shares")
    .insert({
      token,
      board_id: boardId,
      session_id: sessionId,
      expires_at,
    })
    .select("token, board_id, session_id, created_at, expires_at, revoked_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SessionReportShareRow;
}

export async function getOrCreateReportShare({
  boardId,
  sessionId,
}: {
  boardId: string;
  sessionId: string;
}): Promise<SessionReportShareRow> {
  const existing = await getActiveReportShare({ boardId, sessionId });
  if (existing) return existing;
  return createReportShare({ boardId, sessionId });
}

export async function revokeReportShare({
  boardId,
  sessionId,
}: {
  boardId: string;
  sessionId: string;
}): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("board_id", boardId)
    .eq("session_id", sessionId)
    .is("revoked_at", null)
    .select("token");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}

export async function getReportShareByToken(token: string): Promise<SessionReportShareRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("session_report_shares")
    .select("token, board_id, session_id, created_at, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SessionReportShareRow | null) ?? null;
}
