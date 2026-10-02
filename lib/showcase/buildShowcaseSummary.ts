import "server-only";

import { maskPii } from "@/lib/security/piiMask";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const MAX_HIGHLIGHTS = 12;
const MAX_QUESTIONS = 10;

export type ShowcaseSummaryHighlight = {
  type: "clip";
  title: string;
  thumbUrl?: string | null;
  safeText?: string | null;
  at?: string | null;
};

export type ShowcaseSummaryQuestion = {
  text: string;
  count?: number;
  pinned?: boolean;
};

export type ShowcaseSummary = {
  version: 1;
  generatedAt: string;
  board: { title: string | null };
  stats: {
    participantsApprox?: number | null;
    questionsCount: number;
    helpCount: number;
    pollsCount?: number | null;
  };
  highlights: ShowcaseSummaryHighlight[];
  topQuestions: ShowcaseSummaryQuestion[];
  teacherNotes?: string | null;
};

type ShowcaseQuestionRow = {
  body: string | null;
  pinned: boolean | null;
};

export function sanitizeShowcaseText(input: string, maxLength = 140): string | null {
  if (!input) return null;
  let text = input.replace(URL_PATTERN, "").trim();
  if (!text) return null;
  const masked = maskPii(text);
  text = masked.text.trim();
  if (!text) return null;
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
  }
  return text;
}

function resolveParticipantCount(stats: unknown): number | null {
  if (!stats || typeof stats !== "object") return null;
  const value = (stats as { uniqueStudentAuthors?: number | null }).uniqueStudentAuthors;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function buildShowcaseSummary(boardId: string): Promise<ShowcaseSummary> {
  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, title")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !board) {
    throw new Error("showcase_board_not_found");
  }

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, stats, started_at")
    .eq("board_id", boardId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessionId = session?.id ?? null;
  const nowIso = new Date().toISOString();

  const [clipRows, questionRows, questionCountResult, helpCountResult] = await Promise.all([
    supabase
      .from("class_session_clip_shares")
      .select("title, created_at, expires_at, revoked_at")
      .eq("board_id", boardId)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(MAX_HIGHLIGHTS),
    sessionId
      ? supabase
          .from("class_session_questions")
          .select("body, pinned, status, created_at")
          .eq("session_id", sessionId)
          .neq("status", "hidden")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(MAX_QUESTIONS)
      : Promise.resolve({ data: [] as ShowcaseQuestionRow[], error: null }),
    sessionId
      ? supabase
          .from("class_session_questions")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
      : Promise.resolve({ count: 0, error: null }),
    sessionId
      ? supabase
          .from("class_session_events")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("type", "student_action")
          .eq("payload->>kind", "help")
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (clipRows.error) {
    throw new Error(clipRows.error.message);
  }
  if (questionRows.error) {
    throw new Error(questionRows.error.message);
  }
  if (questionCountResult.error) {
    throw new Error(questionCountResult.error.message);
  }
  if (helpCountResult.error) {
    throw new Error(helpCountResult.error.message);
  }

  const highlights: ShowcaseSummaryHighlight[] = (clipRows.data ?? []).map((clip) => {
    const title = sanitizeShowcaseText(clip.title ?? "클립 하이라이트") ?? "클립 하이라이트";
    return {
      type: "clip",
      title,
      safeText: null,
      thumbUrl: null,
      at: clip.created_at ?? null,
    };
  });

  const topQuestions: ShowcaseSummaryQuestion[] = (questionRows.data ?? []).flatMap((row) => {
    const text = sanitizeShowcaseText(row.body ?? "");
    if (!text) {
      return [];
    }
    return [
      {
        text,
        pinned: row.pinned ?? false,
      },
    ];
  });

  const summary: ShowcaseSummary = {
    version: 1,
    generatedAt: nowIso,
    board: { title: sanitizeShowcaseText(board.title ?? "", 60) ?? board.title ?? null },
    stats: {
      participantsApprox: resolveParticipantCount(session?.stats ?? null),
      questionsCount: questionCountResult.count ?? 0,
      helpCount: helpCountResult.count ?? 0,
    },
    highlights,
    topQuestions,
    teacherNotes: null,
  };

  return summary;
}
