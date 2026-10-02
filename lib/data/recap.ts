import { listReadyFilesForCards, type ShareCardFile } from "@/lib/data/files";
import {
  isValidShareCode,
  normalizeShareCode,
} from "@/lib/data/share";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SessionStats } from "@/lib/data/sessions";
import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";

export type SharedRecapBoard = {
  id: string;
  title: string;
  shareCode: string;
};

export type SharedRecapSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  notice: string | null;
  rulesText: string | null;
  stats: SessionStats | null;
  reportTitle: string | null;
  schoolName: string | null;
  className: string | null;
  subject: string | null;
  teacherName: string | null;
  periodLabel: string | null;
  learningGoals: string | null;
  reportTemplate: string | null;
  reportUpdatedAt: string | null;
};

export type SharedRecapWall = {
  id: string;
  title: string;
  description: string | null;
};

export type SharedRecapCard = {
  id: string;
  wallId: string;
  text: string;
  authorType: "teacher" | "student";
  authorName: string | null;
  createdAt: string;
  isFeatured: boolean;
  isPinned: boolean;
  files: ShareCardFile[];
  externalAttachments: ExternalAttachment[];
};

export type SharedRecap = {
  board: SharedRecapBoard;
  session: SharedRecapSession;
  walls: SharedRecapWall[];
  cards: SharedRecapCard[];
};

export async function getSharedRecap(input: {
  code: string;
  sessionId: string;
}): Promise<SharedRecap | null> {
  const normalizedCode = normalizeShareCode(input.code);

  if (!isValidShareCode(normalizedCode)) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, title, share_code, share_enabled")
    .eq("share_code", normalizedCode)
    .eq("share_enabled", true)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board?.share_code) {
    return null;
  }

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select(
      "id, board_id, started_at, ended_at, notice, rules_text, stats, recap_share_enabled, report_title, school_name, class_name, subject, teacher_name, period_label, learning_goals, report_template, report_updated_at",
    )
    .eq("id", input.sessionId)
    .eq("board_id", board.id)
    .not("ended_at", "is", null)
    .eq("recap_share_enabled", true)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessionRow = session as
    | {
        id: string;
        board_id: string;
        started_at: string;
        ended_at: string | null;
        notice: string | null;
        rules_text: string | null;
        stats: SessionStats | null;
        recap_share_enabled: boolean;
        report_title: string | null;
        school_name: string | null;
        class_name: string | null;
        subject: string | null;
        teacher_name: string | null;
        period_label: string | null;
        learning_goals: string | null;
        report_template: string | null;
        report_updated_at: string | null;
      }
    | null;

  if (!sessionRow?.ended_at) {
    return null;
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id, board_id, title, description, position")
    .eq("board_id", board.id)
    .order("position", { ascending: true });

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, created_at, is_featured, is_pinned, external_attachments",
    )
    .in("wall_id", wallIds.length > 0 ? wallIds : [""])
    .gte("created_at", sessionRow.started_at)
    .lte("created_at", sessionRow.ended_at)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("featured_at", { ascending: false })
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  const cardRows = (cards ?? []) as unknown as Array<{
    id: string;
    wall_id: string;
    author_type: string | null;
    author_name: string | null;
    text: string | null;
    created_at: string;
    is_featured: boolean;
    is_pinned: boolean;
    external_attachments: unknown | null;
  }>;

  const cardIds = cardRows.map((card) => card.id);
  const files = await listReadyFilesForCards(cardIds);
  const filesByCardId: Record<string, ShareCardFile[]> = {};

  for (const file of files) {
    filesByCardId[file.cardId] = filesByCardId[file.cardId] ?? [];
    filesByCardId[file.cardId]?.push(file);
  }

  return {
    board: {
      id: board.id,
      title: board.title,
      shareCode: board.share_code,
    },
    session: {
      id: sessionRow.id,
      startedAt: sessionRow.started_at,
      endedAt: sessionRow.ended_at,
      notice: sessionRow.notice ?? null,
      rulesText: sessionRow.rules_text ?? null,
      stats: sessionRow.stats ?? null,
      reportTitle: sessionRow.report_title ?? null,
      schoolName: sessionRow.school_name ?? null,
      className: sessionRow.class_name ?? null,
      subject: sessionRow.subject ?? null,
      teacherName: sessionRow.teacher_name ?? null,
      periodLabel: sessionRow.period_label ?? null,
      learningGoals: sessionRow.learning_goals ?? null,
      reportTemplate: sessionRow.report_template ?? null,
      reportUpdatedAt: sessionRow.report_updated_at ?? null,
    },
    walls: (walls ?? []).map((wall) => ({
      id: wall.id,
      title: wall.title,
      description: wall.description ?? null,
    })),
    cards: cardRows.map((card) => ({
      id: card.id,
      wallId: card.wall_id,
      text: card.text ?? "",
      authorType: (card.author_type as "teacher" | "student") ?? "teacher",
      authorName: card.author_name ?? null,
      createdAt: card.created_at,
      isFeatured: card.is_featured,
      isPinned: card.is_pinned,
      files: filesByCardId[card.id] ?? [],
      externalAttachments: normalizeExternalAttachments(card.external_attachments),
    })),
  };
}
