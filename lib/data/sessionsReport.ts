import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareCode, isValidShareCode, normalizeShareCode } from "./share";
import { SESSION_EVENT_TYPES, type SessionEventType } from "@/lib/types/sessionEvents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { getPollCounts, type PollOption } from "@/lib/data/polls";
import type { SessionReport } from "@/lib/types/sessionReport";

export { SESSION_EVENT_TYPES, type SessionEventType };
export const SNAPSHOT_THROTTLE_MS = 25000;

export type ClassSessionRow = {
  id: string;
  board_id: string;
  share_code: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
  report: SessionReport | null;
  status: string;
  lesson_template_id?: string | null;
};

export type ClassSessionEvent = {
  id: string;
  session_id: string;
  board_id: string;
  share_code: string;
  ts: string;
  type: SessionEventType;
  payload: Record<string, unknown>;
};

type PollSummary = SessionReport["polls"][number];

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

export function normalizeEventPayload(type: SessionEventType, payload: unknown): Record<string, unknown> {
  if (!isPlainObject(payload)) return {};

  const sanitized = { ...payload } as Record<string, unknown>;
  delete sanitized.fingerprint;
  delete sanitized.ip;
  delete sanitized.ipv4;
  delete sanitized.ipv6;
  delete sanitized.userAgent;
  delete sanitized.ua;

  const pick = (keys: string[]) => {
    const result: Record<string, unknown> = {};
    keys.forEach((key) => {
      if (sanitized[key] !== undefined) {
        result[key] = sanitized[key] as unknown;
      }
    });
    return result;
  };

  switch (type) {
    case "step_changed":
      return pick(["stepId", "label", "index"]);
    case "qa_window_changed":
      return pick(["open", "prompt"]);
    case "question_pinned":
      return pick(["questionId"]);
    case "poll_opened":
      return pick(["pollId", "title"]);
    case "poll_closed":
      return pick(["pollId"]);
    case "pulse_reset":
      return {};
    case "nudge_sent":
      return pick(["message"]);
    case "student_action":
      return pick(["actionId", "kind", "text", "reason", "value", "createdAt", "anonId"]);
    case "action_status_changed":
      return pick(["actionId", "status", "handledBy", "handledAt"]);
    case "action_replied":
      return pick(["actionId", "text", "handledBy", "handledAt"]);
    case "hud_settings_changed":
      return pick(["approvalMode", "announcement", "lockStudentInput"]);
    case "triage_updated":
      return pick(["itemId", "delta"]);
    case "snapshot":
      return pick(["presenceCount", "activePollId", "pulseCount", "openQuestionsCount"]);
    default:
      return {};
  }
}

export function shouldThrottleSnapshot(lastSnapshotTs: number | null, now = Date.now()) {
  if (!lastSnapshotTs) return false;
  return now - lastSnapshotTs < SNAPSHOT_THROTTLE_MS;
}

function defaultSessionTitle() {
  const date = new Date();
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}.${m}.${d} 수업`;
}

async function ensureShareCode(boardId: string, existing?: string | null) {
  const supabase = createSupabaseServerClient();
  if (existing) return normalizeShareCode(existing);

  const shareCode = generateShareCode();
  await supabase
    .from("boards")
    .update({ share_code: shareCode, share_enabled: true, share_updated_at: nowIso() })
    .eq("id", boardId);
  return shareCode;
}

export async function startSession({
  boardId,
  shareCode,
  title,
  createdBy,
  classId,
  sectionId,
  lessonTemplateId,
}: {
  boardId: string;
  shareCode?: string | null;
  title?: string | null;
  createdBy?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  lessonTemplateId?: string | null;
}): Promise<ClassSessionRow> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("share_code, active_session_id")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  const normalizedShareCode = await ensureShareCode(
    boardId,
    shareCode && isValidShareCode(shareCode) ? normalizeShareCode(shareCode) : (board?.share_code as string | null),
  );

  const { data, error } = await supabase
    .from("class_sessions")
    .insert({
      board_id: boardId,
      share_code: normalizedShareCode,
      title: title ?? defaultSessionTitle(),
      created_by: createdBy ?? null,
      status: "running",
      class_id: classId ?? null,
      section_id: sectionId ?? null,
      lesson_template_id: lessonTemplateId ?? null,
    })
    .select("id, board_id, share_code, title, started_at, ended_at, created_by, report, status, lesson_template_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const session = data as ClassSessionRow;

  await supabase
    .from("boards")
    .update({ active_session_id: session.id } as never)
    .eq("id", boardId);

  await upsertBoardLiveSession(boardId, {
    activeSessionId: session.id,
    activeSessionStartedAt: session.started_at,
    ts: Date.now(),
  });

  await appendEvent({
    boardId,
    shareCode: normalizedShareCode,
    sessionId: session.id,
    type: "session_started",
    payload: {},
  });

  return session;
}

function buildHighlights(report: SessionReport) {
  const highlights: string[] = [];
  if (report.questions?.total >= 5) {
    highlights.push("질문 참여가 활발했습니다");
  }
  if (report.polls && Array.isArray(report.polls) && report.polls.length > 0) {
    const participation = report.polls
      .map((poll) => poll.total ?? 0)
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0];
    const peak = report.presence?.peak ?? 0;
    if (participation && peak && participation / peak >= 0.7) {
      highlights.push("투표 참여율이 70% 이상입니다");
    } else {
      highlights.push("투표를 진행했습니다");
    }
  }
  if ((report.presence?.peak ?? 0) > 0 && (report.presence?.avg ?? 0) > 0) {
    highlights.push("참여 인원이 안정적으로 유지되었습니다");
  }
  return highlights.slice(0, 3);
}

function calcPresence(events: ClassSessionEvent[]) {
  const snapshots = events.filter((e) => e.type === "snapshot");
  const presenceCounts = snapshots
    .map((e) => (typeof e.payload.presenceCount === "number" ? e.payload.presenceCount : null))
    .filter((v): v is number => v !== null);
  const presencePeak = presenceCounts.length > 0 ? Math.max(...presenceCounts) : 0;
  const presenceAvg = presenceCounts.length > 0 ? Math.round(presenceCounts.reduce((a, b) => a + b, 0) / presenceCounts.length) : 0;
  return { peak: presencePeak, avg: presenceAvg };
}

function calcPulsePeak(events: ClassSessionEvent[]) {
  return Math.max(
    ...events.filter((e) => e.type === "snapshot").map((e) => Number(e.payload.pulseCount) || 0),
    0,
  );
}

function calcFlowSteps(events: ClassSessionEvent[]) {
  return events
    .filter((e) => e.type === "step_changed")
    .map((e) => ({ ts: e.ts, label: e.payload.label, stepId: e.payload.stepId, index: e.payload.index }));
}

async function buildPollSummaries(pollIds: string[]): Promise<PollSummary[]> {
  if (pollIds.length === 0) return [];
  const uniquePollIds = Array.from(new Set(pollIds));
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_polls")
    .select("id, question, options")
    .in("id", uniquePollIds);

  if (error) {
    throw new Error(error.message);
  }

  const pollMap = new Map<string, { question: string; options: PollOption[] }>();
  (data ?? []).forEach((row) => {
    pollMap.set(row.id as string, {
      question: row.question as string,
      options: (row.options ?? []) as PollOption[],
    });
  });

  const summaries: PollSummary[] = [];
  for (const pollId of uniquePollIds) {
    const poll = pollMap.get(pollId);
    let topOption: string | null = null;
    let total = 0;
    if (poll) {
      const counts = await getPollCounts(pollId);
      total = counts.total;
      const topEntry = Object.entries(counts.counts).sort((a, b) => b[1] - a[1])[0];
      const topOptionId = topEntry?.[0];
      if (topOptionId) {
        const option = poll.options.find((item) => item.id === topOptionId);
        topOption = option?.label ?? null;
      }
    }

    summaries.push({
      pollId,
      title: poll?.question ?? null,
      topOption,
      total,
    });
  }

  return summaries;
}

async function countQuestionsInRange(boardId: string, startedAt: string, endedAt: string | null) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("board_questions")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId)
    .gte("created_at", startedAt);

  if (endedAt) {
    query = query.lte("created_at", endedAt);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function buildSessionReport(
  session: ClassSessionRow,
  events: ClassSessionEvent[],
  options?: { questionsTotal?: number; pollSummaries?: PollSummary[] },
): Promise<SessionReport> {
  const presence = calcPresence(events);

  const flowSteps = calcFlowSteps(events);

  const questionPinned = events.filter((e) => e.type === "question_pinned").length;
  const pollsOpened = events.filter((e) => e.type === "poll_opened");
  const polls =
    options?.pollSummaries ??
    (await buildPollSummaries(
      pollsOpened
        .map((poll) => (typeof poll.payload.pollId === "string" ? poll.payload.pollId : null))
        .filter((value): value is string => Boolean(value)),
    ));
  const questionsTotal =
    typeof options?.questionsTotal === "number"
      ? options.questionsTotal
      : await countQuestionsInRange(session.board_id, session.started_at, session.ended_at);

  const report: SessionReport = {
    title: session.title ?? defaultSessionTitle(),
    durationSeconds: session.ended_at
      ? Math.max(0, Math.floor((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000))
      : 0,
    presence,
    flow: { steps: flowSteps },
    questions: { total: questionsTotal, pinned: questionPinned },
    polls,
    pulse: { peak: calcPulsePeak(events) },
  };

  report.highlights = buildHighlights(report);
  return report;
}

export async function endSession({
  boardId,
  sessionId,
}: {
  boardId: string;
  sessionId: string;
}): Promise<ClassSessionRow> {
  const supabase = createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, board_id, share_code, title, started_at, ended_at, created_by, report, status")
    .eq("id", sessionId)
    .eq("board_id", boardId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "세션을 찾을 수 없습니다");
  }

  const { data: eventsData, error: eventsError } = await supabase
    .from("class_session_events")
    .select("id, session_id, board_id, share_code, ts, type, payload")
    .eq("session_id", sessionId)
    .order("ts", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const events = (eventsData ?? []) as ClassSessionEvent[];
  const endedAt = nowIso();
  const report = await buildSessionReport(session as ClassSessionRow, events);

  const { data: updated, error } = await supabase
    .from("class_sessions")
    .update({ ended_at: endedAt, status: "ended", report })
    .eq("id", sessionId)
    .select("id, board_id, share_code, title, started_at, ended_at, created_by, report, status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("boards").update({ active_session_id: null } as never).eq("id", boardId);
  await upsertBoardLiveSession(boardId, {
    activeSessionId: null,
    activeSessionStartedAt: null,
    ts: Date.now(),
  });

  await appendEvent({
    boardId,
    shareCode: session.share_code,
    sessionId,
    type: "session_ended",
    payload: {},
  });

  return updated as ClassSessionRow;
}

export async function appendEvent({
  boardId,
  shareCode,
  sessionId,
  type,
  payload,
}: {
  boardId: string;
  shareCode: string;
  sessionId: string;
  type: SessionEventType;
  payload: unknown;
}): Promise<{ ok: boolean; throttled?: boolean }> {
  if (!SESSION_EVENT_TYPES.includes(type)) {
    throw new Error("unsupported_event_type");
  }

  if (type === "snapshot") {
    const supabase = createSupabaseServerClient();
    const { data: last, error: lastError } = await supabase
      .from("class_session_events")
      .select("ts")
      .eq("session_id", sessionId)
      .eq("type", "snapshot")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      throw new Error(lastError.message);
    }

    const lastTs = last ? Date.parse(last.ts as string) : null;
    if (shouldThrottleSnapshot(lastTs)) {
      return { ok: false, throttled: true };
    }
  }

  const sanitizedPayload = normalizeEventPayload(type, payload);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("class_session_events").insert({
    session_id: sessionId,
    board_id: boardId,
    share_code: shareCode,
    type,
    payload: sanitizedPayload,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}

export async function listSessions({
  boardId,
  limit,
  cursor,
}: {
  boardId: string;
  limit: number;
  cursor?: string | null;
}): Promise<ClassSessionRow[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("class_sessions")
    .select("id, board_id, share_code, title, started_at, ended_at, created_by, report, status")
    .eq("board_id", boardId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("started_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "report_sessions_list_failed",
        boardId,
        message: error.message,
        code: error.code ?? null,
        status: getErrorStatus(error) ?? null,
      }),
    );
    return [];
  }

  return (data ?? []) as ClassSessionRow[];
}

export async function getSession({
  boardId,
  sessionId,
}: {
  boardId: string;
  sessionId: string;
}): Promise<{ session: ClassSessionRow | null; events: ClassSessionEvent[] }> {
  const supabase = createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, board_id, share_code, title, started_at, ended_at, created_by, report, status")
    .eq("id", sessionId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const { data: events, error: eventsError } = await supabase
    .from("class_session_events")
    .select("id, session_id, board_id, share_code, ts, type, payload")
    .eq("session_id", sessionId)
    .order("ts", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  return {
    session: (session as ClassSessionRow | null) ?? null,
    events: (events as ClassSessionEvent[] | null) ?? [],
  };
}
