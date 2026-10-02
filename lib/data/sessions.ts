import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareCode } from "@/lib/data/share";

export type SessionStats = {
  totalCards: number;
  studentCards: number;
  teacherCards: number;
  uniqueStudentAuthors: number;
  topAuthors: { name: string; count: number }[];
  featuredCardId: string | null;
  pinnedCount: number;
  hiddenCount: number;
  topWords: { word: string; count: number }[];
};

export type ClassSession = {
  id: string;
  board_id: string;
  owner_id: string;
  started_at: string;
  ended_at: string | null;
  notice: string | null;
  rules_text: string | null;
  stats: SessionStats | null;
  recap_share_enabled: boolean;
  recap_shared_at: string | null;
  report_title: string | null;
  school_name: string | null;
  class_name: string | null;
  subject: string | null;
  teacher_name: string | null;
  period_label: string | null;
  learning_goals: string | null;
  report_template: string | null;
  report_updated_at: string | null;
  created_at: string;
};

export type SessionReportMetaInput = {
  reportTitle: string | null;
  schoolName: string | null;
  className: string | null;
  subject: string | null;
  teacherName: string | null;
  periodLabel: string | null;
  learningGoals: string | null;
  reportTemplate: string | null;
};

type SessionEndInput = {
  notice: string | null;
  rulesText: string | null;
};

const TOKEN_REGEX = /[A-Za-z0-9가-힣]{2,}/g;
const STOP_WORDS = new Set([
  "그리고",
  "하지만",
  "그러나",
  "그냥",
  "오늘",
  "지금",
  "우리",
  "여러분",
  "합니다",
  "입니다",
  "해서",
  "하는",
  "하기",
  "있습니다",
  "있는",
  "없는",
  "없다",
  "있다",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "have",
  "has",
  "you",
  "your",
  "are",
  "was",
  "were",
  "from",
  "about",
]);

function tokenize(text: string): string[] {
  const matches = text.match(TOKEN_REGEX);
  if (!matches) {
    return [];
  }

  return matches
    .map((word) => word.toLowerCase())
    .filter((word) => !STOP_WORDS.has(word));
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

function buildStats(cards: Array<{
  id: string;
  author_type: string | null;
  author_name: string | null;
  text: string | null;
  is_hidden: boolean;
  is_pinned: boolean;
  is_featured: boolean;
}>) {
  let totalCards = 0;
  let studentCards = 0;
  let teacherCards = 0;
  let pinnedCount = 0;
  let hiddenCount = 0;
  let featuredCardId: string | null = null;
  const authorCounts = new Map<string, number>();
  const studentAuthors = new Set<string>();
  const wordCounts = new Map<string, number>();

  cards.forEach((card) => {
    totalCards += 1;

    if (card.author_type === "student") {
      studentCards += 1;
    }

    if (card.author_type === "teacher") {
      teacherCards += 1;
    }

    if (card.is_pinned) {
      pinnedCount += 1;
    }

    if (card.is_hidden) {
      hiddenCount += 1;
    }

    if (!featuredCardId && card.is_featured) {
      featuredCardId = card.id ?? null;
    }

    if (card.author_name) {
      authorCounts.set(card.author_name, (authorCounts.get(card.author_name) ?? 0) + 1);
      if (card.author_type === "student") {
        studentAuthors.add(card.author_name);
      }
    }

    if (card.text) {
      tokenize(card.text).forEach((token) => {
        wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
      });
    }
  });

  const topAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const stats: SessionStats = {
    totalCards,
    studentCards,
    teacherCards,
    uniqueStudentAuthors: studentAuthors.size,
    topAuthors,
    featuredCardId,
    pinnedCount,
    hiddenCount,
    topWords,
  };

  return stats;
}

export async function getActiveSession(
  boardId: string,
  ownerId: string,
): Promise<ClassSession | null> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, active_session_id")
    .eq("id", boardId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (boardError) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "active_session_board_lookup_failed",
        boardId,
        ownerId,
        message: boardError.message,
        code: boardError.code ?? null,
        status: getErrorStatus(boardError) ?? null,
      }),
    );
    return null;
  }

  if (!board?.active_session_id) {
    return null;
  }

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .eq("id", board.active_session_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (sessionError) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "active_session_lookup_failed",
        boardId,
        ownerId,
        message: sessionError.message,
        code: sessionError.code ?? null,
        status: getErrorStatus(sessionError) ?? null,
      }),
    );
    return null;
  }

  return (session as ClassSession | null) ?? null;
}

export async function getLatestEndedSession(
  boardId: string,
  ownerId: string,
): Promise<ClassSession | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .eq("board_id", boardId)
    .eq("owner_id", ownerId)
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "latest_ended_session_lookup_failed",
        boardId,
        ownerId,
        message: error.message,
        code: error.code ?? null,
        status: getErrorStatus(error) ?? null,
      }),
    );
    return null;
  }

  return (data as ClassSession | null) ?? null;
}

export async function listSessions(
  boardId: string,
  ownerId: string,
): Promise<ClassSession[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .eq("board_id", boardId)
    .eq("owner_id", ownerId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClassSession[] | null) ?? [];
}

export async function startSession(
  boardId: string,
  ownerId: string,
): Promise<ClassSession> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, active_session_id, share_code")
    .eq("id", boardId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    throw new Error("보드를 찾을 수 없습니다.");
  }

  let shareCode = board.share_code as string | null;
  if (!shareCode) {
    shareCode = generateShareCode();
    const { error: shareCodeError } = await supabase
      .from("boards")
      .update({
        share_code: shareCode,
        share_enabled: true,
        share_updated_at: new Date().toISOString(),
      })
      .eq("id", boardId)
      .eq("owner_id", ownerId);

    if (shareCodeError) {
      throw new Error(shareCodeError.message);
    }
  }

  if (board.active_session_id) {
    const { data: existingSession, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
      )
      .eq("id", board.active_session_id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (existingSession) {
      return existingSession as ClassSession;
    }
  }

  const { data: session, error: insertError } = await supabase
    .from("class_sessions")
    .insert({ board_id: boardId, owner_id: ownerId, share_code: shareCode })
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  if (!session) {
    throw new Error("세션을 생성하지 못했습니다.");
  }

  const { error: updateError } = await supabase
    .from("boards")
    .update({ active_session_id: session.id } as never)
    .eq("id", boardId)
    .eq("owner_id", ownerId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return session as ClassSession;
}

export async function endSession(
  boardId: string,
  ownerId: string,
  input: SessionEndInput,
): Promise<ClassSession | null> {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, active_session_id")
    .eq("id", boardId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board?.active_session_id) {
    return null;
  }

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .eq("id", board.active_session_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    return null;
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id")
    .eq("board_id", boardId);

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);
  const endedAt = new Date().toISOString();

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, author_type, author_name, text, is_hidden, is_pinned, is_featured, created_at",
    )
    .in("wall_id", wallIds.length > 0 ? wallIds : [""])
    .gte("created_at", session.started_at)
    .lte("created_at", endedAt)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  const stats = buildStats((cards ?? []) as Array<{
    id: string;
    author_type: string | null;
    author_name: string | null;
    text: string | null;
    is_hidden: boolean;
    is_pinned: boolean;
    is_featured: boolean;
  }>);

  const { data: updatedSession, error: updateError } = await supabase
    .from("class_sessions")
    .update({
      ended_at: endedAt,
      notice: input.notice ?? null,
      rules_text: input.rulesText ?? null,
      stats,
      status: "ended",
    })
    .eq("id", session.id)
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: boardUpdateError } = await supabase
    .from("boards")
    .update({ active_session_id: null } as never)
    .eq("id", boardId)
    .eq("owner_id", ownerId);

  if (boardUpdateError) {
    throw new Error(boardUpdateError.message);
  }

  return (updatedSession as ClassSession | null) ?? null;
}

export async function setRecapShare(
  sessionId: string,
  ownerId: string,
  enabled: boolean,
): Promise<ClassSession> {
  const supabase = createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, ended_at")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    throw new Error("세션을 찾을 수 없습니다.");
  }

  if (!session.ended_at) {
    throw new Error("진행 중인 세션은 공유할 수 없습니다.");
  }

  const { data, error } = await supabase
    .from("class_sessions")
    .update({
      recap_share_enabled: enabled,
      recap_shared_at: enabled ? new Date().toISOString() : null,
    })
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("리캡 공유 상태를 업데이트하지 못했습니다.");
  }

  return data as ClassSession;
}

export async function updateSessionReportMeta(
  sessionId: string,
  ownerId: string,
  input: SessionReportMetaInput,
): Promise<ClassSession> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .update({
      report_title: input.reportTitle,
      school_name: input.schoolName,
      class_name: input.className,
      subject: input.subject,
      teacher_name: input.teacherName,
      period_label: input.periodLabel,
      learning_goals: input.learningGoals,
      report_template: input.reportTemplate,
      report_updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .select(
      "id, board_id, owner_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, recap_shared_at, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at, created_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("보고서 정보를 저장하지 못했습니다.");
  }

  return data as ClassSession;
}
