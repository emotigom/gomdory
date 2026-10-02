import { NextResponse } from "next/server";

import { getClipShareByToken } from "@/lib/data/sessionClipShares";
import { buildPublicClipResponse } from "@/lib/replay/publicClipResponse";
import { sanitizePublicPayload } from "@/lib/replay/publicSanitize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReplayEvent } from "@/lib/replay/sessionReplay";
import { isSessionEventType } from "@/lib/types/sessionEvents";

export const dynamic = "force-dynamic";

type RawEventLike = Partial<{ ts: unknown; type: unknown; payload: unknown }>;
type RawBookmarkLike = Partial<{ id: unknown; ts: unknown; note: unknown }>;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReplayEvents(input: unknown[]): ReplayEvent[] {
  return input
    .map((event) => (isPlainObject(event) ? (event as RawEventLike) : ({} as RawEventLike)))
    .map((event) => {
      if (event.ts === undefined || event.ts === null || event.type === undefined || event.type === null) {
        return null;
      }

      const type = typeof event.type === "string" ? event.type : null;
      if (!type || !isSessionEventType(type)) {
        return null;
      }

      const ts = typeof event.ts === "string" || typeof event.ts === "number" ? String(event.ts) : null;
      if (!ts) return null;

      return {
        ts,
        type,
        payload: isPlainObject(event.payload) ? event.payload : {},
      };
    })
    .filter((event): event is ReplayEvent => Boolean(event));
}

function parseBookmarks(input: unknown[]): Array<{ id: string; ts: string; note: string | null }> {
  return input
    .map((bookmark) => (isPlainObject(bookmark) ? (bookmark as RawBookmarkLike) : ({} as RawBookmarkLike)))
    .map((bookmark) => {
      if (bookmark.id === undefined || bookmark.id === null || bookmark.ts === undefined || bookmark.ts === null) {
        return null;
      }

      const note = typeof bookmark.note === "string" || bookmark.note === null ? bookmark.note : null;
      return {
        id: String(bookmark.id),
        ts: String(bookmark.ts),
        note,
      };
    })
    .filter((bookmark): bookmark is { id: string; ts: string; note: string | null } => Boolean(bookmark));
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token) {
    return jsonError("invalid_token", "유효하지 않은 링크입니다.", 404);
  }

  try {
    const share = await getClipShareByToken(token);
    if (!share) {
      return jsonError("invalid_token", "유효하지 않은 링크입니다.", 404);
    }

    const supabase = createSupabaseAdminClient();
    const { data: events, error: eventsError } = await supabase
      .from("class_session_events")
      .select("ts, type, payload")
      .eq("session_id", share.session_id)
      .eq("board_id", share.board_id)
      .gte("ts", share.clip_start_ts)
      .lte("ts", share.clip_end_ts)
      .order("ts", { ascending: true });

    if (eventsError) {
      return jsonError("clip_fetch_failed", eventsError.message, 502);
    }

    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("class_session_bookmarks")
      .select("id, ts, note")
      .eq("session_id", share.session_id)
      .eq("board_id", share.board_id)
      .gte("ts", share.clip_start_ts)
      .lte("ts", share.clip_end_ts)
      .order("ts", { ascending: true });

    if (bookmarksError) {
      return jsonError("clip_fetch_failed", bookmarksError.message, 502);
    }

    const rawEvents = parseReplayEvents(Array.isArray(events) ? (events as unknown[]) : []);
    const rawBookmarks = parseBookmarks(Array.isArray(bookmarks) ? (bookmarks as unknown[]) : []);

    const sanitized = sanitizePublicPayload(share.mode, {
      events: rawEvents,
      bookmarks: rawBookmarks,
    });

    const response = buildPublicClipResponse({
      share: {
        title: share.title,
        mode: share.mode,
        clip_start_ts: share.clip_start_ts,
        clip_end_ts: share.clip_end_ts,
        created_at: share.created_at,
        expires_at: share.expires_at,
        revoked_at: share.revoked_at,
      },
      payload: sanitized,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "클립을 불러오지 못했습니다.";
    return jsonError("clip_fetch_failed", message, 502);
  }
}
