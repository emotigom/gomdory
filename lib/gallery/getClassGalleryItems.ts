import "server-only";

import { listClassBoards } from "@/lib/data/classes.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GalleryItem = {
  id: string;
  type: "clip" | "board" | "session";
  title: string;
  subtitle: string;
  thumbUrl: string | null;
  primaryHref: string;
  secondaryHref?: string | null;
  primaryLabel?: string;
  secondaryLabel?: string;
  coverKey?: string | null;
  createdAt?: string | null;
};

type ClipShareRow = {
  token: string;
  board_id: string;
  session_id: string;
  title: string | null;
  created_at: string;
  clip_start_ts: string;
  clip_end_ts: string;
  revoked_at: string | null;
  expires_at: string | null;
};

type SessionRow = {
  id: string;
  board_id: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  report_title: string | null;
};

type GalleryOptions = {
  classId: string;
  clipLimit?: number;
  sessionLimit?: number;
  boardLimit?: number;
};

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "최근 업데이트";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "최근 업데이트";
  return new Intl.DateTimeFormat("ko", { month: "short", day: "numeric" }).format(parsed);
}

function sanitizeTitle(value: string | null | undefined, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function resolveCreatedAt(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export async function getClassGalleryItems({
  classId,
  clipLimit = 12,
  sessionLimit = 8,
  boardLimit = 12,
}: GalleryOptions): Promise<GalleryItem[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "로그인이 필요합니다.");
  }

  const boards = await listClassBoards(classId);
  const boardMap = new Map(boards.map((board) => [board.id, board]));
  const boardIds = boards.map((board) => board.id);

  const items: GalleryItem[] = boards.slice(0, boardLimit).map((board) => ({
    id: `board-${board.id}`,
    type: "board",
    title: sanitizeTitle(board.title, "제목 없는 보드"),
    subtitle: `보드 · ${formatDateLabel(board.created_at)}`,
    thumbUrl: null,
    primaryHref: `/dashboard/boards/${board.id}/class`,
    secondaryHref: `/dashboard/classes/${classId}/launch`,
    primaryLabel: "보드 열기",
    secondaryLabel: "수업 시작",
    coverKey: board.board_view_type ? board.board_view_type : board.id,
    createdAt: resolveCreatedAt(board.created_at),
  }));

  if (boardIds.length === 0) {
    return items;
  }

  const { data: sessionRows, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, board_id, started_at, ended_at, created_at, report_title")
    .in("board_id", boardIds)
    .order("started_at", { ascending: false })
    .limit(sessionLimit);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  (sessionRows as SessionRow[] | null)?.forEach((session) => {
    const board = boardMap.get(session.board_id);
    items.push({
      id: `session-${session.id}`,
      type: "session",
      title: sanitizeTitle(session.report_title, "세션 기록"),
      subtitle: `${board?.title ?? "클래스 세션"} · ${formatDateLabel(session.started_at ?? session.created_at)}`,
      thumbUrl: null,
      primaryHref: `/dashboard/boards/${session.board_id}/reports/${session.id}`,
      secondaryHref: `/dashboard/boards/${session.board_id}/replay/${session.id}`,
      primaryLabel: "리포트 열기",
      secondaryLabel: "다시보기",
      coverKey: session.id,
      createdAt: resolveCreatedAt(session.started_at ?? session.created_at),
    });
  });

  const now = Date.now();
  const { data: clipRows, error: clipError } = await supabase
    .from("class_session_clip_shares")
    .select("token, board_id, session_id, title, created_at, clip_start_ts, clip_end_ts, revoked_at, expires_at")
    .in("board_id", boardIds)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(clipLimit);

  if (clipError) {
    throw new Error(clipError.message);
  }

  (clipRows as ClipShareRow[] | null)?.forEach((clip) => {
    if (clip.expires_at) {
      const expiry = Date.parse(clip.expires_at);
      if (!Number.isNaN(expiry) && expiry < now) {
        return;
      }
    }

    const board = boardMap.get(clip.board_id);
    items.push({
      id: `clip-${clip.token}`,
      type: "clip",
      title: sanitizeTitle(clip.title, "클립"),
      subtitle: `${board?.title ?? "보드"} · ${formatDateLabel(clip.created_at)}`,
      thumbUrl: null,
      primaryHref: `/dashboard/boards/${clip.board_id}/replay/${clip.session_id}`,
      secondaryHref: `/dashboard/boards/${clip.board_id}/reports/${clip.session_id}`,
      primaryLabel: "클립 열기",
      secondaryLabel: "리포트",
      coverKey: clip.session_id,
      createdAt: resolveCreatedAt(clip.created_at),
    });
  });

  return items.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}
