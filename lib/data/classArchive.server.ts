import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startSession, endSession, type ClassSessionRow } from "@/lib/data/sessionsReport";

export type ClassSectionRow = {
  id: string;
  class_id: string;
  title: string;
  sort_index: number;
  created_at: string;
};

export type ClassSessionSummaryRow = {
  id: string;
  board_id: string;
  share_code: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  section_id: string | null;
  class_id: string | null;
};

async function requireUserId() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "로그인이 필요합니다.");
  }

  return user.id;
}

export async function listClassSections(classId: string): Promise<ClassSectionRow[]> {
  const supabase = createSupabaseServerClient();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("class_sections")
    .select("id, class_id, title, sort_index, created_at")
    .eq("class_id", classId)
    .eq("created_by", userId)
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClassSectionRow[];
}

export async function createClassSection({
  classId,
  title,
  sortIndex = 0,
}: {
  classId: string;
  title: string;
  sortIndex?: number;
}): Promise<ClassSectionRow> {
  const supabase = createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (classError) {
    throw new Error(classError.message);
  }

  if (!classRow) {
    throw new Error("클래스를 찾지 못했습니다.");
  }

  const { data, error } = await supabase
    .from("class_sections")
    .insert({
      class_id: classId,
      title,
      sort_index: sortIndex,
      created_by: userId,
    })
    .select("id, class_id, title, sort_index, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ClassSectionRow;
}

export async function updateClassSection({
  classId,
  sectionId,
  title,
  sortIndex,
}: {
  classId: string;
  sectionId: string;
  title?: string | null;
  sortIndex?: number | null;
}): Promise<ClassSectionRow> {
  const supabase = createSupabaseServerClient();
  const userId = await requireUserId();

  const updates: Record<string, unknown> = {};
  if (typeof title === "string") {
    updates.title = title;
  }
  if (typeof sortIndex === "number" && Number.isFinite(sortIndex)) {
    updates.sort_index = sortIndex;
  }

  const { data, error } = await supabase
    .from("class_sections")
    .update(updates)
    .eq("id", sectionId)
    .eq("class_id", classId)
    .eq("created_by", userId)
    .select("id, class_id, title, sort_index, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ClassSectionRow;
}

export async function listClassSessions({
  classId,
  sectionId,
  limit,
  cursor,
}: {
  classId: string;
  sectionId: string | null;
  limit: number;
  cursor?: string | null;
}): Promise<ClassSessionSummaryRow[]> {
  const supabase = createSupabaseServerClient();
  const userId = await requireUserId();

  let query = supabase
    .from("class_sessions")
    .select("id, board_id, share_code, title, started_at, ended_at, section_id, class_id")
    .eq("class_id", classId)
    .eq("created_by", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (sectionId) {
    query = query.eq("section_id", sectionId);
  } else {
    query = query.is("section_id", null);
  }

  if (cursor) {
    query = query.lt("started_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClassSessionSummaryRow[];
}

export async function startClassSession({
  classId,
  boardId,
  sectionId,
  lessonTemplateId,
}: {
  classId: string;
  boardId: string;
  sectionId?: string | null;
  lessonTemplateId?: string | null;
}): Promise<ClassSessionRow> {
  const supabase = createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, class_id, share_code")
    .eq("id", boardId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board || board.class_id !== classId) {
    throw new Error("이 클래스에 속한 보드만 선택할 수 있습니다.");
  }

  if (sectionId) {
    const { data: section, error: sectionError } = await supabase
      .from("class_sections")
      .select("id")
      .eq("id", sectionId)
      .eq("class_id", classId)
      .eq("created_by", userId)
      .maybeSingle();

    if (sectionError) {
      throw new Error(sectionError.message);
    }

    if (!section) {
      throw new Error("단원을 찾지 못했습니다.");
    }
  }

  const session = await startSession({
    boardId,
    shareCode: board.share_code ?? null,
    createdBy: userId,
    classId,
    sectionId: sectionId ?? null,
    lessonTemplateId: lessonTemplateId ?? null,
  });

  const { error: classError } = await supabase
    .from("classes")
    .update({ active_board_id: boardId })
    .eq("id", classId)
    .eq("owner_id", userId);

  if (classError) {
    throw new Error(classError.message);
  }

  return session;
}

export async function endClassSession({
  classId,
  sessionId,
}: {
  classId: string;
  sessionId: string;
}): Promise<ClassSessionRow> {
  const supabase = createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: session, error } = await supabase
    .from("class_sessions")
    .select("id, board_id")
    .eq("id", sessionId)
    .eq("class_id", classId)
    .eq("created_by", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.board_id) {
    throw new Error("세션을 찾지 못했습니다.");
  }

  return endSession({ boardId: session.board_id, sessionId });
}
