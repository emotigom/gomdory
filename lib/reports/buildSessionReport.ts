import "server-only";

import { buildClipUrl, buildPresentUrl, buildShareUrl, buildStudentUrl } from "@/lib/http/publicLinks";
import { listClipShares } from "@/lib/data/sessionClipShares";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionReport } from "@/lib/types/sessionReport";

type SessionReportClass = {
  id: string;
  title: string;
  shortCode: string | null;
};

type SessionReportSession = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  summary: string | null;
  teacherNotes: string | null;
  updatedAt: string | null;
};

type SessionReportSection = {
  id: string;
  title: string;
};

type SessionReportBoard = {
  id: string;
  title: string;
};

type SessionReportLinks = {
  studentUrl: string | null;
  shareUrl: string | null;
  boardUrl: string;
  hudUrl: string | null;
  replayUrl: string;
};

export type SessionReportPollSummary = {
  title: string | null;
  topOption: string | null;
  total: number;
};

export type SessionReportClip = {
  title: string | null;
  url: string;
  createdAt: string;
};

export type SessionReportPinnedQuestion = {
  id: string;
  body: string;
};

export type SessionReportDto = {
  classInfo: SessionReportClass;
  session: SessionReportSession;
  section: SessionReportSection | null;
  board: SessionReportBoard;
  links: SessionReportLinks;
  stats: {
    presencePeak: number;
    presenceAvg: number;
    questionsTotal: number;
    questionsPinned: number;
    pollsCount: number;
    pulsePeak: number;
    durationSeconds: number;
  };
  polls: SessionReportPollSummary[];
  pinnedQuestions: SessionReportPinnedQuestion[];
  clips: SessionReportClip[];
  safeMode: boolean;
};

type SessionRow = {
  id: string;
  board_id: string;
  share_code: string | null;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  teacher_notes: string | null;
  updated_at: string | null;
  class_id: string | null;
  section_id: string | null;
  report: SessionReport | null;
};

type ClassRow = { id: string; title: string; short_code: string | null };
type BoardRow = { id: string; title: string };
type SectionRow = { id: string; title: string };

type BuildSessionReportDeps = {
  getClass?: (input: { classId: string; userId: string }) => Promise<ClassRow | null>;
  getSession?: (input: { classId: string; sessionId: string; userId: string }) => Promise<SessionRow | null>;
  getSection?: (input: { classId: string; sectionId: string }) => Promise<SectionRow | null>;
  getBoard?: (input: { boardId: string; userId: string }) => Promise<BoardRow | null>;
  listClips?: (input: { sessionId: string }) => Promise<SessionReportClip[]>;
  getPinnedQuestions?: (input: {
    sessionId: string;
    boardId: string;
    limit?: number;
  }) => Promise<SessionReportPinnedQuestion[]>;
};

function toMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) return 0;
  const diffMs = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.max(1, Math.round(diffMs / 60000));
}

async function defaultGetClass({ classId, userId }: { classId: string; userId: string }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, title, short_code")
    .eq("id", classId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as ClassRow | null) ?? null;
}

async function defaultGetSession({
  classId,
  sessionId,
  userId,
}: {
  classId: string;
  sessionId: string;
  userId: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, board_id, share_code, title, started_at, ended_at, summary, teacher_notes, updated_at, class_id, section_id, report",
    )
    .eq("id", sessionId)
    .eq("class_id", classId)
    .eq("created_by", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as SessionRow | null) ?? null;
}

async function defaultGetSection({ classId, sectionId }: { classId: string; sectionId: string }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sections")
    .select("id, title")
    .eq("id", sectionId)
    .eq("class_id", classId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as SectionRow | null) ?? null;
}

async function defaultGetBoard({ boardId, userId }: { boardId: string; userId: string }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, title")
    .eq("id", boardId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as BoardRow | null) ?? null;
}

async function defaultListClips({ sessionId }: { sessionId: string }) {
  const clipShares = await listClipShares(sessionId);
  return clipShares
    .filter((clip) => !clip.revoked_at)
    .map((clip) => ({
      title: clip.title ?? null,
      url: buildClipUrl(clip.token),
      createdAt: clip.created_at,
    }));
}

async function defaultGetPinnedQuestions({
  sessionId,
  boardId,
  limit = 5,
}: {
  sessionId: string;
  boardId: string;
  limit?: number;
}) {
  const supabase = createSupabaseServerClient();
  const { data: events, error } = await supabase
    .from("class_session_events")
    .select("payload, ts")
    .eq("session_id", sessionId)
    .eq("type", "question_pinned")
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const questionIds = (events ?? [])
    .map((event) => {
      const payload = event.payload as { questionId?: unknown } | null;
      return typeof payload?.questionId === "string" ? payload.questionId : null;
    })
    .filter((value): value is string => Boolean(value));

  if (questionIds.length === 0) {
    return [];
  }

  const { data: questions, error: questionsError } = await supabase
    .from("board_questions")
    .select("id, body")
    .eq("board_id", boardId)
    .in("id", questionIds);

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  const bodyMap = new Map<string, string>();
  (questions ?? []).forEach((question) => {
    bodyMap.set(question.id as string, question.body as string);
  });

  return questionIds
    .map((id) => {
      const body = bodyMap.get(id);
      return body ? { id, body } : null;
    })
    .filter((item): item is SessionReportPinnedQuestion => Boolean(item));
}

export async function buildSessionReport(
  input: { classId: string; sessionId: string; userId: string },
  deps?: BuildSessionReportDeps,
): Promise<SessionReportDto> {
  const getClass = deps?.getClass ?? defaultGetClass;
  const getSession = deps?.getSession ?? defaultGetSession;
  const getSection = deps?.getSection ?? defaultGetSection;
  const getBoard = deps?.getBoard ?? defaultGetBoard;
  const listClips = deps?.listClips ?? defaultListClips;
  const getPinnedQuestions = deps?.getPinnedQuestions ?? defaultGetPinnedQuestions;

  const classInfo = await getClass({ classId: input.classId, userId: input.userId });
  if (!classInfo) {
    throw new Error("클래스를 찾지 못했습니다.");
  }

  const session = await getSession({ classId: input.classId, sessionId: input.sessionId, userId: input.userId });
  if (!session) {
    throw new Error("회차를 찾지 못했습니다.");
  }

  const board = await getBoard({ boardId: session.board_id, userId: input.userId });
  if (!board) {
    throw new Error("보드를 찾지 못했습니다.");
  }

  const section = session.section_id ? await getSection({ classId: input.classId, sectionId: session.section_id }) : null;
  const clips = await listClips({ sessionId: session.id });
  const pinnedQuestions = await getPinnedQuestions({ sessionId: session.id, boardId: session.board_id });

  const report = session.report ?? null;
  const durationSeconds = report?.durationSeconds ?? 0;
  const durationMinutes = toMinutes(session.started_at, session.ended_at);

  return {
    classInfo: {
      id: classInfo.id,
      title: classInfo.title,
      shortCode: classInfo.short_code ?? null,
    },
    session: {
      id: session.id,
      title: session.title ?? "수업 리포트",
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationMinutes,
      summary: session.summary ?? null,
      teacherNotes: session.teacher_notes ?? null,
      updatedAt: session.updated_at ?? null,
    },
    section: section ? { id: section.id, title: section.title } : null,
    board: {
      id: board.id,
      title: board.title,
    },
    links: {
      studentUrl: classInfo.short_code ? buildStudentUrl(`/k/${classInfo.short_code}`) : null,
      shareUrl: session.share_code ? buildShareUrl(session.share_code) : null,
      boardUrl: `/dashboard/boards/${session.board_id}`,
      hudUrl: session.share_code ? buildPresentUrl(session.share_code) : null,
      replayUrl: `/dashboard/boards/${session.board_id}/replay/${session.id}`,
    },
    stats: {
      presencePeak: report?.presence?.peak ?? 0,
      presenceAvg: report?.presence?.avg ?? 0,
      questionsTotal: report?.questions?.total ?? 0,
      questionsPinned: report?.questions?.pinned ?? 0,
      pollsCount: report?.polls?.length ?? 0,
      pulsePeak: report?.pulse?.peak ?? 0,
      durationSeconds,
    },
    polls: (report?.polls ?? []).map((poll) => ({
      title: typeof poll.title === "string" ? poll.title : poll.title ? String(poll.title) : null,
      topOption: poll.topOption ?? null,
      total: poll.total ?? 0,
    })),
    pinnedQuestions,
    clips,
    safeMode: true,
  };
}
