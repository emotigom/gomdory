import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExhibitHighlight, ExhibitHighlightKind, ExhibitPayload } from "@/lib/exhibit/types";
import { sanitizeExhibitPayload, sanitizeExhibitText } from "@/lib/exhibit/sanitize";

const MAX_CARD_CANDIDATES = 120;

type CardRow = {
  id: string;
  text: string;
  is_featured: boolean;
  is_pinned: boolean;
  external_attachments: unknown | null;
};

function resolveLayout(viewType: string | null | undefined): "gallery" | "columns" {
  if (viewType === "columns") {
    return "columns";
  }
  return "gallery";
}

function resolveKind(text: string): ExhibitHighlightKind {
  const normalized = text.toLowerCase();
  if (normalized.includes("?") || normalized.includes("왜") || normalized.includes("어떻게")) {
    return "question";
  }
  if (normalized.includes("결과") || normalized.includes("정리") || normalized.includes("완료")) {
    return "result";
  }
  return "idea";
}

function resolveTitle(kind: ExhibitHighlightKind): string {
  switch (kind) {
    case "question":
      return "질문 카드";
    case "result":
      return "결과 카드";
    case "photo_placeholder":
      return "이미지 제출";
    default:
      return "아이디어 카드";
  }
}

function countExternalAttachments(value: unknown): number {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object" && "length" in (value as { length?: number })) {
    const length = (value as { length?: number }).length;
    return typeof length === "number" ? length : 0;
  }
  return 0;
}

export async function generateSafePayload(boardId: string): Promise<ExhibitPayload> {
  const admin = createSupabaseAdminClient();
  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("id, title, board_view_type, share_code")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !board) {
    throw new Error("exhibit_board_not_found");
  }

  const { data: walls, error: wallsError } = await admin
    .from("walls")
    .select("id")
    .eq("board_id", boardId);

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id).filter(Boolean);
  const wallCount = wallIds.length;

  const cardCountResult = wallIds.length
    ? await admin
        .from("cards")
        .select("id", { count: "exact", head: true })
        .in("wall_id", wallIds)
        .is("deleted_at", null)
        .eq("is_hidden", false)
    : { count: 0, error: null };

  if (cardCountResult.error) {
    throw new Error(cardCountResult.error.message);
  }

  const { data: cardCandidates, error: cardError } = wallIds.length
    ? await admin
        .from("cards")
        .select("id, text, is_featured, is_pinned, external_attachments")
        .in("wall_id", wallIds)
        .is("deleted_at", null)
        .eq("is_hidden", false)
        .order("is_featured", { ascending: false })
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(MAX_CARD_CANDIDATES)
    : { data: [] as CardRow[], error: null };

  if (cardError) {
    throw new Error(cardError.message);
  }

  const cardRows = (cardCandidates ?? []) as CardRow[];
  const cardIds = cardRows.map((card) => card.id);

  const attachmentCounts = new Map<string, number>();
  if (cardIds.length > 0) {
    const { data: files, error: filesError } = await admin
      .from("files")
      .select("card_id")
      .in("card_id", cardIds);

    if (filesError) {
      throw new Error(filesError.message);
    }

    for (const file of files ?? []) {
      const cardId = (file as { card_id?: string | null }).card_id;
      if (!cardId) continue;
      attachmentCounts.set(cardId, (attachmentCounts.get(cardId) ?? 0) + 1);
    }
  }

  const highlights: ExhibitHighlight[] = cardRows.flatMap((card) => {
    const attachmentCount =
      (attachmentCounts.get(card.id) ?? 0) + countExternalAttachments(card.external_attachments);
    if (attachmentCount > 0) {
      return [
        {
          type: "card",
          title: resolveTitle("photo_placeholder"),
          textPreview: `이미지 ${attachmentCount}개 제출됨`,
          kind: "photo_placeholder",
          score: card.is_featured ? 2 : card.is_pinned ? 1 : 0,
        },
      ];
    }

    const preview = sanitizeExhibitText(card.text, 120);
    if (!preview) return [];
    const kind = resolveKind(preview);
    return [
      {
        type: "card",
        title: resolveTitle(kind),
        textPreview: preview,
        kind,
        score: card.is_featured ? 2 : card.is_pinned ? 1 : 0,
      },
    ];
  });

  const { data: session, error: sessionError } = await admin
    .from("class_sessions")
    .select("id, started_at")
    .eq("board_id", boardId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessionId = session?.id ?? null;

  const [questionCountResult, helpCountResult] = await Promise.all([
    sessionId
      ? admin
          .from("class_session_questions")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
      : Promise.resolve({ count: 0, error: null }),
    sessionId
      ? admin
          .from("class_session_events")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("type", "student_action")
          .eq("payload->>kind", "help")
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (questionCountResult.error) {
    throw new Error(questionCountResult.error.message);
  }
  if (helpCountResult.error) {
    throw new Error(helpCountResult.error.message);
  }

  const { data: polls, error: pollsError } = await admin
    .from("board_polls")
    .select("id")
    .eq("board_id", boardId);

  if (pollsError) {
    throw new Error(pollsError.message);
  }

  const pollIds = (polls ?? []).map((poll) => poll.id);
  const pollResponsesResult = pollIds.length
    ? await admin.from("poll_responses").select("poll_id", { count: "exact", head: true }).in("poll_id", pollIds)
    : { count: 0, error: null };

  if (pollResponsesResult.error) {
    throw new Error(pollResponsesResult.error.message);
  }

  const shareCode = board.share_code ?? null;
  const pulseResult = shareCode
    ? await admin.from("pulse_events").select("kind", { count: "exact", head: true }).eq("share_code", shareCode)
    : { count: 0, error: null };

  if (pulseResult.error) {
    throw new Error(pulseResult.error.message);
  }

  const timeline = [
    { label: "질문", count: questionCountResult.count ?? 0 },
    { label: "도움 요청", count: helpCountResult.count ?? 0 },
    { label: "투표 참여", count: pollResponsesResult.count ?? 0 },
    { label: "반응", count: pulseResult.count ?? 0 },
  ].filter((entry) => entry.count > 0);

  const payload: ExhibitPayload = sanitizeExhibitPayload({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    board: {
      title: sanitizeExhibitText(board.title ?? "", 60) ?? "수업 결과 전시",
      themeHint: null,
      layout: resolveLayout(board.board_view_type),
      counts: { cards: cardCountResult.count ?? 0, columns: wallCount },
    },
    highlights,
    aggregates: {
      questionsCount: questionCountResult.count ?? 0,
      helpCount: helpCountResult.count ?? 0,
      votesSummary: pollIds.length
        ? { pollsCount: pollIds.length, responsesCount: pollResponsesResult.count ?? 0 }
        : undefined,
      pulseSummary: shareCode ? { total: pulseResult.count ?? 0 } : undefined,
    },
    timeline,
    notes: {},
  });

  return payload;
}
