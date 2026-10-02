"use client";

import { routes } from "@/lib/standards/routes";

type SessionEventPayload = Record<string, unknown>;

export async function appendSessionEvent({
  boardId,
  sessionId,
  type,
  payload,
}: {
  boardId: string;
  sessionId: string;
  type: string;
  payload: SessionEventPayload;
}) {
  try {
    await fetch(routes.api.boards.byId(boardId, "sessions", sessionId, "events"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // ignore transient errors
  }
}
