import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertBoardLiveSession } from "./liveSession";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuestionRow = {
  id: string;
  session_id: string;
  board_id: string;
  body: string;
  status: "pending" | "approved" | "hidden";
  pinned: boolean;
  teacher_reply: string | null;
  updated_at: string;
};

type ControlsRow = {
  session_id: string;
  questions_locked: boolean;
  help_locked: boolean;
  updated_at: string;
};

function sanitizeReplyText(text: unknown): string {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length > 120) {
    return trimmed.slice(0, 120);
  }
  return trimmed;
}

function containsUrl(text: string) {
  return /(https?:\/\/|www\.)/i.test(text);
}

export async function moderateSessionQuestion({
  sessionId,
  questionId,
  status,
  pinned,
}: {
  sessionId: string;
  questionId: string;
  status?: "approved" | "hidden" | "pending";
  pinned?: boolean;
}): Promise<QuestionRow | null> {
  if (!UUID_REGEX.test(sessionId) || !UUID_REGEX.test(questionId)) {
    throw new Error("Invalid identifiers");
  }
  const supabase = createSupabaseServerClient();

  const { data: question, error: questionError } = await supabase
    .from("class_session_questions")
    .select("id, session_id, board_id, body, status, pinned, teacher_reply, updated_at")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError) {
    throw new Error(questionError.message);
  }
  const row = question as QuestionRow | null;
  if (!row || row.session_id !== sessionId) {
    return null;
  }

  const updates: Partial<QuestionRow> = {};
  if (status) {
    updates.status = status as QuestionRow["status"];
  }
  if (typeof pinned === "boolean") {
    updates.pinned = pinned;
  }

  if (pinned === true) {
    await supabase
      .from("class_session_questions")
      .update({ pinned: false })
      .eq("session_id", sessionId)
      .neq("id", questionId);
  }

  const { data: updated, error: updateError } = await supabase
    .from("class_session_questions")
    .update(updates)
    .eq("id", questionId)
    .select("id, session_id, board_id, body, status, pinned, teacher_reply, updated_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const moderated = updated as QuestionRow | null;

  if (typeof pinned === "boolean") {
    const pinnedState = pinned ? questionId : null;
    await upsertBoardLiveSession(
      row.board_id,
      { pinnedQuestionId: pinnedState, pinnedQuestionUpdatedAt: Date.now() },
      { useServiceRole: true },
    );
  }

  return moderated;
}

export async function replyToSessionQuestion({
  sessionId,
  questionId,
  replyText,
}: {
  sessionId: string;
  questionId: string;
  replyText: string;
}): Promise<QuestionRow | null> {
  if (!UUID_REGEX.test(sessionId) || !UUID_REGEX.test(questionId)) {
    throw new Error("Invalid identifiers");
  }
  const supabase = createSupabaseServerClient();

  const sanitized = sanitizeReplyText(replyText);
  if (!sanitized) return null;
  if (containsUrl(sanitized)) {
    throw new Error("URL not allowed in reply");
  }

  const { data: question, error: questionError } = await supabase
    .from("class_session_questions")
    .select("id, session_id, board_id, body, status, pinned, teacher_reply, updated_at")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError) {
    throw new Error(questionError.message);
  }
  const row = question as QuestionRow | null;
  if (!row || row.session_id !== sessionId) {
    return null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("class_session_questions")
    .update({ teacher_reply: sanitized })
    .eq("id", questionId)
    .select("id, session_id, board_id, body, status, pinned, teacher_reply, updated_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return updated as QuestionRow | null;
}

export async function updateSessionControls({
  sessionId,
  questionsLocked,
  helpLocked,
}: {
  sessionId: string;
  questionsLocked?: boolean;
  helpLocked?: boolean;
}): Promise<ControlsRow> {
  if (!UUID_REGEX.test(sessionId)) {
    throw new Error("Invalid identifiers");
  }
  const supabase = createSupabaseServerClient();

  const payload: Partial<ControlsRow> = {};
  if (typeof questionsLocked === "boolean") {
    payload.questions_locked = questionsLocked;
  }
  if (typeof helpLocked === "boolean") {
    payload.help_locked = helpLocked;
  }

  const { data, error } = await supabase
    .from("class_session_controls")
    .upsert({ session_id: sessionId, ...payload }, { onConflict: "session_id" })
    .select("session_id, questions_locked, help_locked, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ControlsRow;
}

export async function getSessionHudSnapshot(sessionId: string) {
  if (!UUID_REGEX.test(sessionId)) {
    throw new Error("Invalid identifiers");
  }
  const supabase = createSupabaseServerClient();

  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, board_id")
    .eq("id", sessionId)
    .maybeSingle();

  const boardId = (session as { board_id?: string } | null)?.board_id ?? null;

  const [pendingCount, approvedCount, pinnedQuestion, controls] = await Promise.all([
    supabase
      .from("class_session_questions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "pending"),
    supabase
      .from("class_session_questions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "approved"),
    supabase
      .from("class_session_questions")
      .select("id, session_id, board_id, body, status, pinned, teacher_reply, updated_at")
      .eq("session_id", sessionId)
      .eq("pinned", true)
      .order("updated_at", { ascending: false })
      .maybeSingle(),
    supabase
      .from("class_session_controls")
      .select("session_id, questions_locked, help_locked, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  const counts = {
    pendingQuestions: pendingCount.count ?? 0,
    approvedQuestions: approvedCount.count ?? 0,
  };

  const pinned = pinnedQuestion.data as QuestionRow | null;
  const controlsRow = controls.data as ControlsRow | null;

  let participants = 0;
  let reactionsLast60s = 0;
  let quickPoll: { id: string; title?: string | null } | null = null;

  if (boardId) {
    const admin = createSupabaseAdminClient();
    const { data: liveRow } = await admin
      .from("board_live_session")
      .select("snapshot")
      .eq("board_id", boardId)
      .maybeSingle();

    const snapshot = (liveRow as { snapshot?: unknown } | null)?.snapshot as
      | {
          presenceCount?: number;
          reactions?: { last60s?: number };
          quickPoll?: { id: string; title?: string | null } | null;
          poll?: { id: string; title?: string | null } | null;
        }
      | null
      | undefined;

    participants = snapshot?.presenceCount ?? 0;
    reactionsLast60s = snapshot?.reactions?.last60s ?? 0;
    const activePoll = snapshot?.quickPoll ?? snapshot?.poll;
    if (activePoll && typeof activePoll === "object" && "id" in activePoll) {
      quickPoll = { id: (activePoll as { id: string }).id, title: (activePoll as { title?: string | null }).title ?? null };
    }
  }

  return {
    counts: {
      participants,
      pendingQuestions: counts.pendingQuestions,
      approvedQuestions: counts.approvedQuestions,
      helpRequestsLast60s: 0,
      reactionsLast60s,
    },
    pinnedQuestion: pinned ?? null,
    controls: controlsRow ?? { session_id: sessionId, questions_locked: false, help_locked: false, updated_at: new Date().toISOString() },
    activeQuickPoll: quickPoll,
  };
}
