import "server-only";

import { getPollCounts, type PollOption } from "@/lib/data/polls";
import { getPulseCounts } from "@/lib/data/pulse";
import { sanitizeShowcaseText } from "@/lib/showcase/buildShowcaseSummary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_POLL_HIGHLIGHTS = 2;
const MAX_POLL_OPTIONS = 3;
const MAX_GALLERY_ITEMS = 6;

export type ShowcaseSnapshotMetric = {
  participants: number;
  questionsCount: number;
  helpRequests: number;
  pollsCount: number;
};

export type ShowcaseSnapshotHighlight =
  | {
      kind: "poll";
      title: string;
      topOptions: Array<{ label: string; count: number }>;
    }
  | {
      kind: "pulse";
      label: string;
      valueAvg: number;
    };

export type ShowcaseSnapshotGalleryItem = {
  kind: "card";
  thumbUrl: string | null;
  caption: string;
};

export type ShowcaseSnapshot = {
  version: 1;
  boardId: string;
  generatedAt: string;
  headline: string;
  metrics: ShowcaseSnapshotMetric;
  highlights: ShowcaseSnapshotHighlight[];
  gallery: ShowcaseSnapshotGalleryItem[];
};

type SessionRow = {
  id: string;
  stats: unknown | null;
};

type PollRow = {
  id: string;
  question: string;
  options: PollOption[];
};

type ClipRow = {
  title: string | null;
};

function resolveParticipantCount(stats: unknown): number {
  if (!stats || typeof stats !== "object") return 0;
  const value = (stats as { uniqueStudentAuthors?: number | null }).uniqueStudentAuthors;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function resolvePollHighlights(polls: PollRow[], pollCounts: Map<string, Record<string, number>>): ShowcaseSnapshotHighlight[] {
  const highlights: ShowcaseSnapshotHighlight[] = [];

  for (const poll of polls.slice(0, MAX_POLL_HIGHLIGHTS)) {
    const counts = pollCounts.get(poll.id) ?? {};
    const topOptions = poll.options
      .map((option) => ({
        label: sanitizeShowcaseText(option.label, 60) ?? option.label,
        count: counts[option.id] ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_POLL_OPTIONS);

    highlights.push({
      kind: "poll",
      title: sanitizeShowcaseText(poll.question, 80) ?? "투표",
      topOptions,
    });
  }

  return highlights;
}

export async function buildShowcaseSnapshot(boardId: string): Promise<ShowcaseSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("id, title, share_code")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !board) {
    throw new Error("showcase_board_not_found");
  }

  const { data: session, error: sessionError } = await admin
    .from("class_sessions")
    .select("id, stats, started_at")
    .eq("board_id", boardId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessionId = (session as SessionRow | null)?.id ?? null;
  const nowIso = new Date().toISOString();

  const [questionCountResult, helpCountResult, pollEventRows, clipRows] = await Promise.all([
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
    sessionId
      ? admin
          .from("class_session_events")
          .select("payload, created_at")
          .eq("session_id", sessionId)
          .in("type", ["poll_opened", "poll_closed"])
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as Array<{ payload: Record<string, unknown> }>, error: null }),
    admin
      .from("class_session_clip_shares")
      .select("title, created_at, expires_at, revoked_at")
      .eq("board_id", boardId)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(MAX_GALLERY_ITEMS),
  ]);

  if (questionCountResult.error) {
    throw new Error(questionCountResult.error.message);
  }
  if (helpCountResult.error) {
    throw new Error(helpCountResult.error.message);
  }
  if (pollEventRows.error) {
    throw new Error(pollEventRows.error.message);
  }
  if (clipRows.error) {
    throw new Error(clipRows.error.message);
  }

  const pollIds: string[] = [];
  for (const row of pollEventRows.data ?? []) {
    const payload = row.payload as { pollId?: unknown } | null;
    const pollId = typeof payload?.pollId === "string" ? payload.pollId : null;
    if (pollId && !pollIds.includes(pollId)) {
      pollIds.push(pollId);
    }
  }

  const pollsResult = pollIds.length
    ? await admin
        .from("board_polls")
        .select("id, question, options")
        .in("id", pollIds)
    : { data: [] as PollRow[], error: null };

  if (pollsResult.error) {
    throw new Error(pollsResult.error.message);
  }

  const pollRows = (pollsResult.data ?? []) as PollRow[];
  const pollCounts = new Map<string, Record<string, number>>();
  await Promise.all(
    pollRows.map(async (poll) => {
      const counts = await getPollCounts(poll.id);
      pollCounts.set(poll.id, counts.counts);
    }),
  );

  const pollHighlights = resolvePollHighlights(pollRows, pollCounts);
  const highlights: ShowcaseSnapshotHighlight[] = [...pollHighlights];

  if (board.share_code) {
    const pulse = await getPulseCounts(board.share_code);
    const total = pulse.ok + pulse.unsure + pulse.help;
    if (total > 0) {
      const average = (pulse.ok * 5 + pulse.unsure * 3 + pulse.help * 1) / total;
      highlights.push({
        kind: "pulse",
        label: "집중도",
        valueAvg: Math.round(average * 10) / 10,
      });
    }
  }

  const gallery: ShowcaseSnapshotGalleryItem[] = (clipRows.data as ClipRow[] | null)?.map((clip) => ({
    kind: "card",
    thumbUrl: null,
    caption: sanitizeShowcaseText(clip.title ?? "클립", 60) ?? "클립",
  })) ?? [];

  return {
    version: 1,
    boardId,
    generatedAt: nowIso,
    headline: sanitizeShowcaseText(board.title ?? "", 80) ?? "오늘의 수업 결과",
    metrics: {
      participants: resolveParticipantCount((session as SessionRow | null)?.stats ?? null),
      questionsCount: questionCountResult.count ?? 0,
      helpRequests: helpCountResult.count ?? 0,
      pollsCount: pollIds.length,
    },
    highlights,
    gallery,
  };
}
