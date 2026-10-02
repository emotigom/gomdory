import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCard } from "@/lib/data/cards";
import { getLiveSessionByShareCode } from "@/lib/data/liveSession";
import { getBoardByShareCode } from "@/lib/data/share";
import { listWalls } from "@/lib/data/walls";

export type QuestionStatus = "queued" | "approved" | "pinned" | "archived" | "deleted";

export type QuestionRow = {
  id: string;
  boardId: string;
  shareCode: string;
  author: string | null;
  body: string;
  status: QuestionStatus;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type QuestionRowDb = {
  id: string;
  board_id: string;
  share_code: string;
  author: string | null;
  body: string;
  status: QuestionStatus;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

const QUESTION_SELECT =
  "id, board_id, share_code, author, body, status, pinned, created_at, updated_at";

const BODY_LIMIT = 200;
const THROTTLE_WINDOW_MS = 8_000;
const DEDUPE_WINDOW_MS = 60_000;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const HTML_TAG_REGEX = /<[^>]*>/g;
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const dedupeMap = new Map<string, number>();

export class QuestionGuardError extends Error {
  code: "RATE_LIMIT" | "DUPLICATE" | "INVALID_BODY";
  status: number;

  constructor(code: "RATE_LIMIT" | "DUPLICATE" | "INVALID_BODY", message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function mapQuestion(row: QuestionRowDb): QuestionRow {
  return {
    id: row.id,
    boardId: row.board_id,
    shareCode: row.share_code,
    author: row.author,
    body: row.body,
    status: row.status,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stripHtml(input: string) {
  return input.replace(HTML_TAG_REGEX, "");
}

export function normalizeQuestionBody(input: string) {
  return stripHtml(input)
    .replace(ZERO_WIDTH_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BODY_LIMIT);
}

export function isWithinWindow(now: number, lastAt: number | null, windowMs: number) {
  if (!lastAt) return false;
  return now - lastAt < windowMs;
}

function hasLongRun(text: string, limit = 6) {
  let run = 1;
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] === text[i - 1]) {
      run += 1;
      if (run >= limit) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

function isOnlyEmoji(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const hasWord = /[\p{L}\p{N}]/u.test(trimmed);
  if (hasWord) return false;
  return /[\p{Extended_Pictographic}]/u.test(trimmed);
}

export function spamHeuristics(body: string) {
  if (!body.trim()) return true;
  if (hasLongRun(body, 6)) return true;
  if (isOnlyEmoji(body)) return true;

  const urlMatches = body.match(URL_REGEX) ?? [];
  if (urlMatches.length >= 2) return true;
  if (urlMatches.length === 1) {
    const urlLength = urlMatches[0]?.length ?? 0;
    if (urlLength / body.length > 0.6) return true;
  }

  const alphaNumeric = body.replace(/[^\p{L}\p{N}]/gu, "");
  if (alphaNumeric.length < 2 && body.length > 6) return true;

  return false;
}

export async function getQnaStateForShare(code: string): Promise<{
  open: boolean;
  endsAt: number | null;
  prompt: string | null;
}> {
  const snapshot = await getLiveSessionByShareCode(code);
  if (!snapshot) {
    return { open: false, endsAt: null, prompt: null };
  }
  const now = Date.now();
  const endsAt = snapshot.qnaEndsAt ?? null;
  const open = snapshot.qnaOpen === true && (!endsAt || endsAt > now);
  return {
    open,
    endsAt,
    prompt: snapshot.qnaPrompt ?? null,
  };
}

export async function isQnaOpenForShare(code: string): Promise<boolean> {
  const state = await getQnaStateForShare(code);
  return state.open;
}

function buildDedupeKey(code: string, fingerprint: string, body: string) {
  return `${code}:${fingerprint}:${body}`;
}

export async function throttleCheckAndTouch(code: string, fingerprint: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_question_throttles")
    .select("last_submit_at, submit_count")
    .eq("share_code", code)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const now = Date.now();
  const lastSubmitAt = data?.last_submit_at ? new Date(data.last_submit_at).getTime() : null;

  if (isWithinWindow(now, lastSubmitAt, THROTTLE_WINDOW_MS)) {
    throw new QuestionGuardError("RATE_LIMIT", "잠깐만요! 8초 뒤 다시 질문을 보내주세요.", 429);
  }

  const nextCount = (data?.submit_count ?? 0) + 1;
  const { error: upsertError } = await supabase
    .from("board_question_throttles")
    .upsert(
      {
        share_code: code,
        fingerprint,
        last_submit_at: new Date(now).toISOString(),
        submit_count: nextCount,
      },
      { onConflict: "share_code,fingerprint" },
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export async function dedupeCheck(code: string, fingerprint: string, normalizedBody: string) {
  const key = buildDedupeKey(code, fingerprint, normalizedBody);
  const now = Date.now();
  const last = dedupeMap.get(key) ?? null;

  if (isWithinWindow(now, last, DEDUPE_WINDOW_MS)) {
    throw new QuestionGuardError("DUPLICATE", "같은 내용이 방금 전송됐어요.", 409);
  }

  dedupeMap.set(key, now);

  if (dedupeMap.size > 200) {
    for (const [entryKey, timestamp] of dedupeMap.entries()) {
      if (!isWithinWindow(now, timestamp, DEDUPE_WINDOW_MS * 2)) {
        dedupeMap.delete(entryKey);
      }
    }
  }
}

export async function createQuestionByShareCode(
  code: string,
  input: { author?: string | null; body: string },
): Promise<QuestionRow> {
  const board = await getBoardByShareCode(code);

  if (!board) {
    throw new Error("SHARE_NOT_FOUND");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_questions")
    .insert({
      board_id: board.id,
      share_code: code,
      author: input.author ?? null,
      body: input.body,
      status: "queued",
      pinned: false,
    })
    .select(QUESTION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "질문을 저장하지 못했습니다.");
  }

  return mapQuestion(data as QuestionRowDb);
}

export async function listQuestionsForBoard(
  boardId: string,
  options?: { status?: QuestionStatus; limit?: number; cursor?: string },
): Promise<{ items: QuestionRow[]; nextCursor: string | null }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("board_questions")
    .select(QUESTION_SELECT)
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row) => mapQuestion(row as QuestionRowDb));
  const nextCursor = items.length > 0 ? items[items.length - 1]?.createdAt ?? null : null;

  return { items, nextCursor };
}

export async function updateQuestion(
  boardId: string,
  id: string,
  patch: { status?: QuestionStatus; pinned?: boolean },
): Promise<QuestionRow> {
  const supabase = createSupabaseAdminClient();

  if (patch.pinned === true) {
    await supabase
      .from("board_questions")
      .update({
        pinned: false,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("board_id", boardId)
      .eq("pinned", true);
  }

  const update: Partial<QuestionRowDb> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.status === "string") {
    update.status = patch.status;
  }

  if (typeof patch.pinned === "boolean") {
    update.pinned = patch.pinned;
  }

  const { data, error } = await supabase
    .from("board_questions")
    .update(update)
    .eq("board_id", boardId)
    .eq("id", id)
    .select(QUESTION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "질문을 업데이트하지 못했습니다.");
  }

  return mapQuestion(data as QuestionRowDb);
}

export async function getPinnedForShareCode(code: string): Promise<QuestionRow | null> {
  const board = await getBoardByShareCode(code);

  if (!board) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_questions")
    .select(QUESTION_SELECT)
    .eq("board_id", board.id)
    .eq("pinned", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0] as QuestionRowDb | undefined;
  return row ? mapQuestion(row) : null;
}

export async function listApprovedForShareCode(
  code: string,
  limit = 10,
): Promise<QuestionRow[]> {
  const board = await getBoardByShareCode(code);

  if (!board) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_questions")
    .select(QUESTION_SELECT)
    .eq("board_id", board.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapQuestion(row as QuestionRowDb));
}

export async function getPinnedForBoard(boardId: string): Promise<QuestionRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_questions")
    .select(QUESTION_SELECT)
    .eq("board_id", boardId)
    .eq("pinned", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0] as QuestionRowDb | undefined;
  return row ? mapQuestion(row) : null;
}

export async function convertQuestionToCard(
  boardId: string,
  questionId: string,
  options?: { target?: "board" | "wall" },
): Promise<{ cardId: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_questions")
    .select("id, board_id, body, author, status")
    .eq("board_id", boardId)
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("질문을 찾을 수 없습니다.");
  }

  const walls = await listWalls(boardId);
  const target = options?.target ?? "board";
  const targetWall = target === "wall" ? walls[0] : walls[0];

  if (!targetWall) {
    throw new Error("담벼락이 없습니다.");
  }

  const authorSuffix = data.author ? `\n— ${data.author}` : "";
  const text = `Q: ${data.body}${authorSuffix}`;
  const card = await createCard({ wallId: targetWall.id, text, boardId });

  await updateQuestion(boardId, questionId, {
    status: "archived",
    pinned: false,
  });

  return { cardId: card.id };
}
