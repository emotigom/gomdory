import "server-only";

import { randomHex } from "@/lib/crypto/webcrypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBoardByShareCode } from "@/lib/data/share";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";

export type PollOption = { id: string; label: string };

export type PollSnapshot = {
  id: string;
  open: boolean;
  endsAt?: number | null;
  question: string;
  options: PollOption[];
  counts?: Record<string, number>;
  total?: number;
  updatedAt: number;
};

type PollRow = {
  id: string;
  board_id: string;
  share_code: string;
  question: string;
  options: PollOption[];
  created_at: string;
  closed_at: string | null;
};

const OPTION_LIMIT = [2, 6] as const;
const QUESTION_LIMIT = 200;
const OPTION_LABEL_LIMIT = 80;
const POLL_THROTTLE_MS = 5000;

export class PollError extends Error {
  status: number;
  code: "NOT_FOUND" | "INVALID_INPUT" | "RATE_LIMIT" | "CLOSED";

  constructor(
    code: "NOT_FOUND" | "INVALID_INPUT" | "RATE_LIMIT" | "CLOSED",
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function normalizePollOptions(options: unknown): PollOption[] {
  if (!Array.isArray(options)) {
    throw new PollError("INVALID_INPUT", "옵션은 2~6개 필요해요.", 400);
  }

  if (options.length < OPTION_LIMIT[0] || options.length > OPTION_LIMIT[1]) {
    throw new PollError("INVALID_INPUT", "옵션은 2~6개 필요해요.", 400);
  }

  const ids = new Set<string>();
  return options.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new PollError("INVALID_INPUT", "옵션 형식이 올바르지 않아요.", 400);
    }
    const option = raw as { id?: string; label?: string };
    const id = (option.id || randomHex(4)).trim();
    const label = (option.label ?? "").trim();

    if (!id || !label) {
      throw new PollError("INVALID_INPUT", "옵션은 비어있을 수 없어요.", 400);
    }

    if (label.length > OPTION_LABEL_LIMIT) {
      throw new PollError(
        "INVALID_INPUT",
        `옵션은 ${OPTION_LABEL_LIMIT}자 이내로 입력해주세요.`,
        400,
      );
    }

    if (ids.has(id)) {
      throw new PollError("INVALID_INPUT", "옵션 ID가 중복되었어요.", 400);
    }
    ids.add(id);

    return { id, label };
  });
}

export function normalizePollQuestion(question: unknown) {
  if (typeof question !== "string") {
    throw new PollError("INVALID_INPUT", "질문을 입력해주세요.", 400);
  }
  const trimmed = question.trim().slice(0, QUESTION_LIMIT);
  if (!trimmed) {
    throw new PollError("INVALID_INPUT", "질문을 입력해주세요.", 400);
  }
  return trimmed;
}

function mapPoll(row: PollRow): PollSnapshot {
  return {
    id: row.id,
    open: !row.closed_at,
    endsAt: null,
    question: row.question,
    options: row.options,
    counts: undefined,
    total: undefined,
    updatedAt: new Date(row.created_at).getTime(),
  };
}

async function fetchPoll(pollId: string, expectedBoardId?: string): Promise<PollRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_polls")
    .select("id, board_id, share_code, question, options, created_at, closed_at")
    .eq("id", pollId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new PollError("NOT_FOUND", "투표를 찾을 수 없어요.", 404);
  }
  if (expectedBoardId && data.board_id !== expectedBoardId) {
    throw new PollError("NOT_FOUND", "투표를 찾을 수 없어요.", 404);
  }
  return data as PollRow;
}

export async function createPoll(
  boardId: string,
  shareCode: string,
  question: unknown,
  options: unknown,
): Promise<PollSnapshot> {
  const board = await getBoardByShareCode(shareCode);
  if (!board || board.id !== boardId) {
    throw new PollError("NOT_FOUND", "보드 정보를 확인할 수 없어요.", 404);
  }

  const normalizedQuestion = normalizePollQuestion(question);
  const normalizedOptions = normalizePollOptions(options);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("board_polls")
    .insert({
      board_id: boardId,
      share_code: shareCode,
      question: normalizedQuestion,
      options: normalizedOptions,
      closed_at: new Date().toISOString(),
    })
    .select("id, board_id, share_code, question, options, created_at, closed_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "투표를 만들지 못했습니다.");
  }

  const poll = mapPoll(data as PollRow);
  await upsertBoardLiveSession(
    boardId,
    {
      poll: { ...poll, open: false, updatedAt: Date.now() },
      ts: Date.now(),
    },
    { useServiceRole: true },
  );
  return poll;
}

export async function openPoll(
  pollId: string,
  endsAt?: number | null,
  expectedBoardId?: string,
): Promise<PollSnapshot> {
  const row = await fetchPoll(pollId, expectedBoardId);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("board_polls")
    .update({ closed_at: null })
    .eq("id", pollId);

  if (error) {
    throw new Error(error.message);
  }

  const counts = await getPollCounts(pollId);
  const poll: PollSnapshot = {
    id: row.id,
    open: true,
    endsAt: endsAt ?? null,
    question: row.question,
    options: row.options,
    counts: counts.counts,
    total: counts.total,
    updatedAt: Date.now(),
  };

  await upsertBoardLiveSession(row.board_id, { poll, ts: Date.now() }, { useServiceRole: true });
  return poll;
}

export async function closePoll(pollId: string, expectedBoardId?: string): Promise<PollSnapshot> {
  const row = await fetchPoll(pollId, expectedBoardId);
  const supabase = createSupabaseAdminClient();
  const closedAt = new Date().toISOString();
  const { error } = await supabase.from("board_polls").update({ closed_at: closedAt }).eq("id", pollId);

  if (error) {
    throw new Error(error.message);
  }

  const counts = await getPollCounts(pollId);
  const poll: PollSnapshot = {
    id: row.id,
    open: false,
    endsAt: null,
    question: row.question,
    options: row.options,
    counts: counts.counts,
    total: counts.total,
    updatedAt: Date.now(),
  };

  await upsertBoardLiveSession(row.board_id, { poll, ts: Date.now() }, { useServiceRole: true });
  return poll;
}

async function ensureThrottle(pollId: string, fingerprint: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("poll_responses")
    .select("created_at")
    .eq("poll_id", pollId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const now = Date.now();
  const createdAt = data?.created_at ? new Date(data.created_at).getTime() : null;
  if (createdAt && now - createdAt < POLL_THROTTLE_MS) {
    throw new PollError("RATE_LIMIT", "잠시 후에 다시 시도해주세요.", 429);
  }
}

export async function submitPollResponse(
  pollId: string,
  shareCode: string,
  fingerprint: string,
  optionId: string,
): Promise<{ counts: Record<string, number>; total: number }> {
  const poll = await fetchPoll(pollId);
  if (poll.share_code !== shareCode) {
    throw new PollError("NOT_FOUND", "투표를 찾을 수 없어요.", 404);
  }
  if (poll.closed_at) {
    throw new PollError("CLOSED", "투표가 종료되었어요.", 403);
  }

  await ensureThrottle(pollId, fingerprint);

  const optionExists = poll.options.some((option) => option.id === optionId);
  if (!optionExists) {
    throw new PollError("INVALID_INPUT", "옵션을 찾을 수 없어요.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("poll_responses")
    .upsert(
      {
        poll_id: pollId,
        share_code: shareCode,
        fingerprint,
        option_id: optionId,
        created_at: new Date().toISOString(),
      },
      { onConflict: "poll_id,fingerprint" },
    );

  if (error) {
    throw new Error(error.message);
  }

  const counts = await getPollCounts(pollId);

  await upsertBoardLiveSession(
    poll.board_id,
    {
      poll: {
        id: poll.id,
        open: true,
        endsAt: null,
        question: poll.question,
        options: poll.options,
        counts: counts.counts,
        total: counts.total,
        updatedAt: Date.now(),
      },
      ts: Date.now(),
    },
    { useServiceRole: true },
  );

  return counts;
}

export async function getPollCounts(
  pollId: string,
): Promise<{ counts: Record<string, number>; total: number }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("poll_responses")
    .select("option_id")
    .eq("poll_id", pollId);

  if (error) {
    throw new Error(error.message);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const optionId = row.option_id as string;
    counts[optionId] = (counts[optionId] ?? 0) + 1;
  }

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { counts, total };
}
