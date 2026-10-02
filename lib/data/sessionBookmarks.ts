import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionBookmarkRow = {
  id: string;
  board_id: string;
  session_id: string;
  ts: string;
  note: string | null;
  created_at: string;
};

const MAX_NOTE_LENGTH = 200;

export function normalizeBookmarkNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NOTE_LENGTH);
}

export async function createBookmark({
  boardId,
  sessionId,
  note,
}: {
  boardId: string;
  sessionId: string;
  note?: unknown;
}): Promise<SessionBookmarkRow> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_session_bookmarks")
    .insert({
      board_id: boardId,
      session_id: sessionId,
      note: normalizeBookmarkNote(note),
    })
    .select("id, board_id, session_id, ts, note, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "북마크를 저장하지 못했습니다.");
  }

  return data as SessionBookmarkRow;
}

export async function listBookmarks(sessionId: string): Promise<SessionBookmarkRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_session_bookmarks")
    .select("id, board_id, session_id, ts, note, created_at")
    .eq("session_id", sessionId)
    .order("ts", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SessionBookmarkRow[];
}
