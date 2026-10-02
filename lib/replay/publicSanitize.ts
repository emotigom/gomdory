import { maskPii } from "@/lib/security/piiMask";
import { isSessionEventType, type SessionEventType } from "@/lib/types/sessionEvents";
import type { ReplayEvent } from "@/lib/replay/sessionReplay";

export type PublicBookmark = {
  id: string;
  ts: string;
  note: string | null;
};

export type PublicClipPayload = {
  events: ReplayEvent[];
  bookmarks: PublicBookmark[];
};

type ClipShareMode = "safe" | "full";

type SanitizedPayload = {
  events: ReplayEvent[];
  bookmarks: PublicBookmark[];
};

const SAFE_EVENT_ALLOWLIST: Record<SessionEventType, string[]> = {
  session_started: [],
  session_ended: [],
  step_changed: ["stepId", "label", "description", "index", "timerSeconds"],
  qa_window_changed: ["open", "prompt"],
  question_pinned: ["questionId"],
  poll_opened: ["pollId", "title"],
  poll_closed: ["pollId"],
  pulse_reset: [],
  nudge_sent: [],
  student_action: ["kind", "createdAt"],
  action_status_changed: ["status", "handledAt"],
  action_replied: ["handledAt"],
  hud_settings_changed: ["approvalMode", "lockStudentInput"],
  triage_updated: ["itemId", "delta"],
  snapshot: ["presenceCount", "pulseCount", "activePollId"],
};

function pickPayload(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in payload) {
      next[key] = payload[key];
    }
  }
  return next;
}

function sanitizeEvent(mode: ClipShareMode, event: ReplayEvent): ReplayEvent | null {
  if (!isSessionEventType(event.type)) return null;
  const payload = event.payload ?? {};
  if (mode === "safe") {
    const allowed = SAFE_EVENT_ALLOWLIST[event.type];
    if (!allowed) return null;
    return { ...event, payload: pickPayload(payload, allowed) };
  }

  const basePayload = { ...payload } as Record<string, unknown>;
  if (event.type === "question_pinned") {
    delete basePayload.title;
  }

  if (typeof basePayload.text === "string") {
    const masked = maskPii(basePayload.text);
    basePayload.text = masked.text;
  }

  if (typeof basePayload.message === "string") {
    const masked = maskPii(basePayload.message);
    basePayload.message = masked.text;
  }

  return { ...event, payload: basePayload };
}

export function sanitizePublicPayload(mode: ClipShareMode, input: PublicClipPayload): SanitizedPayload {
  const events = input.events
    .map((event) => sanitizeEvent(mode, event))
    .filter((event): event is ReplayEvent => Boolean(event));

  const bookmarks = input.bookmarks.map((bookmark) => ({
    ...bookmark,
    note: mode === "safe" ? null : bookmark.note,
  }));

  return { events, bookmarks };
}
