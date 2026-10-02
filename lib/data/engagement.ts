import { randomHex } from "@/lib/crypto/webcrypto";

export type ReactionEvent = { emoji: string; anonId: string; at: number };

export type ReactionSnapshot = {
  totals: Record<string, number>;
  recent: ReactionEvent[];
  updatedAt: number;
  windowSeconds: number;
};

export type QuickPollState = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  counts: number[];
  total: number;
  open: boolean;
  endsAt: number | null;
  updatedAt: number;
  voterMap?: Record<string, number>;
};

export type SpotlightState = { text: string; updatedAt: number } | null;

export type LiveEngagementState = {
  reactions?: ReactionSnapshot;
  reactionGuards?: Record<string, number>;
  quickPoll?: QuickPollState | null;
  spotlight?: SpotlightState;
};

const REACTION_WINDOW_MS = 60_000;
const REACTION_RATE_LIMIT_MS = 1_000;
const REACTION_RECENT_LIMIT = 240;
const QUICK_POLL_QUESTION_LIMIT = 120;
const QUICK_POLL_OPTIONS_RANGE: [number, number] = [2, 4];

export function ensureAnonId(seed?: string) {
  if (seed && /^[a-z0-9]{10,64}$/i.test(seed)) return seed;
  return randomHex(12);
}

export function applyReaction(
  current: LiveEngagementState,
  emoji: string,
  anonId: string,
  now: number,
): { next: LiveEngagementState; rateLimited: boolean } {
  const guards = { ...(current.reactionGuards ?? {}) };
  const lastAt = guards[anonId] ?? 0;
  if (now - lastAt < REACTION_RATE_LIMIT_MS) {
    return { next: current, rateLimited: true };
  }

  guards[anonId] = now;
  const existing = current.reactions ?? {
    totals: {},
    recent: [],
    updatedAt: now,
    windowSeconds: REACTION_WINDOW_MS / 1000,
  };

  const recent = existing.recent.filter((event) => now - event.at <= REACTION_WINDOW_MS);
  recent.push({ emoji, anonId, at: now });

  if (recent.length > REACTION_RECENT_LIMIT) {
    recent.splice(0, recent.length - REACTION_RECENT_LIMIT);
  }

  const totals = { ...existing.totals };
  totals[emoji] = (totals[emoji] ?? 0) + 1;

  return {
    rateLimited: false,
    next: {
      ...current,
      reactions: {
        totals,
        recent,
        updatedAt: now,
        windowSeconds: existing.windowSeconds,
      },
      reactionGuards: guards,
    },
  };
}

function normalizeQuickPollQuestion(question: unknown): string {
  if (typeof question !== "string") {
    throw new Error("질문을 입력해주세요.");
  }
  const trimmed = question.trim();
  if (!trimmed) throw new Error("질문을 입력해주세요.");
  return trimmed.slice(0, QUICK_POLL_QUESTION_LIMIT);
}

function normalizeQuickPollOptions(options: unknown): { id: string; label: string }[] {
  if (!Array.isArray(options)) {
    throw new Error("선택지는 배열이어야 합니다.");
  }

  if (
    options.length < QUICK_POLL_OPTIONS_RANGE[0] ||
    options.length > QUICK_POLL_OPTIONS_RANGE[1]
  ) {
    throw new Error("선택지는 2~4개만 설정할 수 있어요.");
  }

  return options.map((raw, index) => {
    if (typeof raw !== "string") {
      throw new Error("선택지는 문자열이어야 합니다.");
    }
    const label = raw.trim();
    if (!label) throw new Error("빈 선택지는 사용할 수 없어요.");
    return { id: randomHex(4) + index.toString(), label: label.slice(0, 80) };
  });
}

export function openQuickPoll(
  current: LiveEngagementState,
  payload: { question: unknown; options: unknown; durationSec?: number | null },
  now: number,
): QuickPollState {
  const question = normalizeQuickPollQuestion(payload.question);
  const options = normalizeQuickPollOptions(payload.options);
  const durationMs = (payload.durationSec ?? 10) * 1000;
  const endsAt = durationMs > 0 ? now + durationMs : now + 10_000;

  return {
    id: crypto.randomUUID(),
    question,
    options,
    counts: Array(options.length).fill(0),
    total: 0,
    open: true,
    endsAt,
    updatedAt: now,
    voterMap: {},
  };
}

export function applyQuickPollVote(
  poll: QuickPollState,
  optionIndex: number,
  anonId: string,
  now: number,
): { poll: QuickPollState; ignored: boolean } {
  if (!poll.open) return { poll, ignored: true };
  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    throw new Error("선택지가 올바르지 않습니다.");
  }

  const voterMap = { ...(poll.voterMap ?? {}) };
  if (voterMap[anonId]) {
    return { poll, ignored: true };
  }

  voterMap[anonId] = optionIndex;
  const counts = [...poll.counts];
  counts[optionIndex] += 1;

  return {
    ignored: false,
    poll: {
      ...poll,
      counts,
      total: poll.total + 1,
      updatedAt: now,
      voterMap,
    },
  };
}

export function closeQuickPoll(poll: QuickPollState, now: number): QuickPollState {
  if (!poll.open) return poll;
  return { ...poll, open: false, endsAt: now, updatedAt: now };
}

export function sanitizeQuickPoll(poll: QuickPollState | null | undefined): QuickPollState | null {
  if (!poll) return null;
  const { voterMap, ...rest } = poll;
  void voterMap;
  return rest;
}
