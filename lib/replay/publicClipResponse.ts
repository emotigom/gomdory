import type { ClipShareMode } from "@/lib/data/sessionClipShares";
import type { PublicBookmark } from "@/lib/replay/publicSanitize";
import type { ReplayEvent } from "@/lib/replay/sessionReplay";

export type PublicClipMeta = {
  title: string | null;
  mode: ClipShareMode;
  clipStartTs: string;
  clipEndTs: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type PublicClipPayload = {
  session: { started_at: string; ended_at: string | null; status: string };
  events: ReplayEvent[];
  bookmarks: PublicBookmark[];
};

type PublicClipShareInput = {
  title: string | null;
  mode: ClipShareMode;
  clip_start_ts: string;
  clip_end_ts: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type PublicClipResponseInput = {
  share: PublicClipShareInput;
  payload: { events: ReplayEvent[]; bookmarks: PublicBookmark[] };
};

export function buildPublicClipResponse({ share, payload }: PublicClipResponseInput) {
  return {
    ok: true as const,
    meta: {
      title: share.title,
      mode: share.mode,
      clipStartTs: share.clip_start_ts,
      clipEndTs: share.clip_end_ts,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      revokedAt: share.revoked_at,
    },
    payload: {
      session: {
        started_at: share.clip_start_ts,
        ended_at: share.clip_end_ts,
        status: "ended",
      },
      events: payload.events,
      bookmarks: payload.bookmarks,
    },
  };
}
