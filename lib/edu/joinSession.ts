import crypto from "crypto";

import { isLikelyJoinToken } from "@/lib/edu/joinTokenRequest";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

const EDU_JOIN_TOKEN_BYTES = 16;
const PARTICIPANT_SUBJECT_BYTES = 32;
const STUDENT_SUBMISSION_OWNER_SECRET_MIN_LENGTH = 32;
const EDU_JOIN_TTL_MS = 1000 * 60 * 60 * 24;
const STUDENT_SUBMISSION_OWNER_DOMAIN = "student-submission-owner:v1";
const STUDENT_SUBMISSION_OWNERSHIP_VERSION = 1;

export type EduJoinSessionPayload = {
  shareCode: string;
  nickname: string | null;
  boardId: string | null;
};

const getJoinToken = () => crypto.randomBytes(EDU_JOIN_TOKEN_BYTES).toString("base64url");

function getStudentSubmissionOwnerSecret(): string | null {
  return readEnvString("STUDENT_SUBMISSION_OWNER_HMAC_SECRET") ?? null;
}

/**
 * Produces the database-safe, board-scoped representation of a server-created
 * participant subject. The raw subject never leaves this module or reaches a
 * database row.
 */
export function hashStudentSubmissionParticipantSubject(input: {
  boardId: string;
  participantSubject: string;
  secret?: string | null;
}): string | null {
  const secret = input.secret === undefined ? getStudentSubmissionOwnerSecret() : input.secret?.trim() ?? null;
  if (!secret || secret.length < STUDENT_SUBMISSION_OWNER_SECRET_MIN_LENGTH || !input.boardId || !input.participantSubject) return null;
  // JSON array serialization provides unambiguous UTF-8 framing for the
  // domain, board ID, and opaque subject; never concatenate user data.
  const canonicalInput = JSON.stringify([STUDENT_SUBMISSION_OWNER_DOMAIN, input.boardId, input.participantSubject]);
  return crypto
    .createHmac("sha256", secret)
    .update(canonicalInput, "utf8")
    .digest("hex");
}

export type TrustedParticipantOwnershipContext = {
  ownershipVersion: typeof STUDENT_SUBMISSION_OWNERSHIP_VERSION;
  participantOwnerHash: string;
};

export function trustedParticipantOwnershipFromSession(
  session: { boardId: string | null; shareCode: string | null; expiresAt: string | null; participantSubjectHash: string | null },
  boardId: string,
  now = Date.now(),
): TrustedParticipantOwnershipContext | null {
  if (!boardId || session.boardId !== boardId || !session.shareCode) return null;
  const expiresAt = session.expiresAt ? Date.parse(session.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  if (!session.participantSubjectHash || !/^[a-f0-9]{64}$/.test(session.participantSubjectHash)) return null;
  return { ownershipVersion: STUDENT_SUBMISSION_OWNERSHIP_VERSION, participantOwnerHash: session.participantSubjectHash };
}

export async function createEduJoinSession(input: EduJoinSessionPayload): Promise<string | null> {
  if (!input.shareCode) return null;

  const supabase = createSupabaseAdminClient();
  const token = getJoinToken();
  // Do not derive this from a share code, nickname, client ID, or token. Only
  // the keyed, board-scoped hash is persisted; the opaque source is discarded.
  const participantSubjectHash = input.boardId
    ? hashStudentSubmissionParticipantSubject({
      boardId: input.boardId,
      participantSubject: crypto.randomBytes(PARTICIPANT_SUBJECT_BYTES).toString("base64url"),
    })
    : null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EDU_JOIN_TTL_MS);

  const payload = {
    [EDU_COLUMNS.token]: token,
    [EDU_COLUMNS.shareCode]: input.shareCode,
    [EDU_COLUMNS.nickname]: input.nickname,
    [EDU_COLUMNS.boardId]: input.boardId,
    [EDU_COLUMNS.createdAt]: now.toISOString(),
    [EDU_COLUMNS.expiresAt]: expiresAt.toISOString(),
    [EDU_COLUMNS.lastUsedAt]: null,
    [EDU_COLUMNS.participantSubjectHash]: participantSubjectHash,
  };

  const { error } = await supabase.from(EDU_TABLES.joinSessions).insert(payload);
  if (error) {
    return null;
  }

  return token;
}

/**
 * Resolves only ownership-safe data for a validated, board-bound student join
 * session. Existing sessions without a server-created subject intentionally
 * remain untrusted; they are never backfilled from browser-controlled values.
 */
export async function getTrustedParticipantOwnershipContext(
  token: string,
  boardId: string,
): Promise<TrustedParticipantOwnershipContext | null> {
  const trimmed = token.trim();
  if (!boardId || !isLikelyJoinToken(trimmed)) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.joinSessions)
    .select([EDU_COLUMNS.boardId, EDU_COLUMNS.shareCode, EDU_COLUMNS.expiresAt, EDU_COLUMNS.participantSubjectHash].join(", "))
    .eq(EDU_COLUMNS.token, trimmed)
    .maybeSingle()) as {
    data: Database["public"]["Tables"]["edu_join_sessions"]["Row"] | null;
    error: { message: string } | null;
  };

  if (error || !data) return null;
  return trustedParticipantOwnershipFromSession({
    boardId: data.board_id,
    shareCode: data.share_code,
    expiresAt: data.expires_at,
    participantSubjectHash: data.participant_subject_hash,
  }, boardId);
}

export async function getEduJoinSession(token: string): Promise<EduJoinSessionPayload | null> {
  const trimmed = token.trim();
  if (!isLikelyJoinToken(trimmed)) return null;

  const supabase = createSupabaseAdminClient();
  const selectFields = [
    EDU_COLUMNS.token,
    EDU_COLUMNS.shareCode,
    EDU_COLUMNS.nickname,
    EDU_COLUMNS.boardId,
    EDU_COLUMNS.expiresAt,
  ].join(", ");

  const { data, error } = (await supabase
    .from(EDU_TABLES.joinSessions)
    .select(selectFields)
    .eq(EDU_COLUMNS.token, trimmed)
    .maybeSingle()) as {
    data: Database["public"]["Tables"]["edu_join_sessions"]["Row"] | null;
    error: { message: string } | null;
  };

  if (error || !data) return null;

  const expiresAt = data.expires_at;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return null;
  }

  void supabase
    .from(EDU_TABLES.joinSessions)
    .update({ [EDU_COLUMNS.lastUsedAt]: new Date().toISOString() })
    .eq(EDU_COLUMNS.token, trimmed);

  return {
    shareCode: data.share_code ?? "",
    nickname: data.nickname ?? null,
    boardId: data.board_id ?? null,
  };
}

export async function getEduJoinSessionSafe(token: string): Promise<{
  session: EduJoinSessionPayload | null;
  state: "resolved" | "invalid" | "lookup_error";
}> {
  try {
    const session = await getEduJoinSession(token);
    if (!session?.shareCode) {
      return { session: null, state: "invalid" };
    }
    return { session, state: "resolved" };
  } catch {
    return { session: null, state: "lookup_error" };
  }
}

export async function updateEduJoinSessionNickname(token: string, nickname: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!isLikelyJoinToken(trimmed)) return false;

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const { data, error } = await supabase
    .from(EDU_TABLES.joinSessions)
    .update({
      [EDU_COLUMNS.nickname]: nickname,
      [EDU_COLUMNS.lastUsedAt]: now.toISOString(),
    })
    .eq(EDU_COLUMNS.token, trimmed)
    .gt(EDU_COLUMNS.expiresAt, now.toISOString())
    .select(EDU_COLUMNS.token);

  if (error) {
    return false;
  }

  return Boolean(data?.length);
}
