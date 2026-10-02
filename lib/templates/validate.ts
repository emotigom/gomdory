import "server-only";

import type { TemplatePayload } from "@/lib/templates/sanitize";

const MAX_PAYLOAD_BYTES = 200 * 1024;
const MAX_CARDS = 400;
const MAX_TAGS = 8;
const TITLE_MIN = 2;
const TITLE_MAX = 40;

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

export function validateTemplatePayload(payload: TemplatePayload): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required");
  }

  const title = payload.title?.trim() ?? "";
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    throw new Error("title must be between 2 and 40 characters");
  }

  const tags = payload.tags ?? [];
  if (tags.length > MAX_TAGS) {
    throw new Error("too many tags");
  }

  if (payload.board.cards.length > MAX_CARDS) {
    throw new Error("too many cards");
  }

  if (byteLength(payload) > MAX_PAYLOAD_BYTES) {
    throw new Error("payload exceeds size limit");
  }
}
