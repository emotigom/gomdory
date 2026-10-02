import { maskPii } from "@/lib/security/piiMask";
import type { ExhibitHighlight, ExhibitPayload } from "@/lib/exhibit/types";

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const TOKEN_PATTERN = /\b[A-Za-z0-9_-]{18,}\b/g;

export const EXHIBIT_LIMITS = {
  highlights: 24,
  textPreview: 120,
  payloadBytes: 120 * 1024,
};

export function sanitizeExhibitText(input: string, maxLength = EXHIBIT_LIMITS.textPreview): string | null {
  if (!input) return null;
  let text = input.replace(URL_PATTERN, "").trim();
  if (!text) return null;
  const masked = maskPii(text);
  text = masked.text.replace(TOKEN_PATTERN, "[토큰]").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
  }
  return text;
}

function sanitizeHighlight(highlight: ExhibitHighlight): ExhibitHighlight | null {
  const preview = sanitizeExhibitText(highlight.textPreview, EXHIBIT_LIMITS.textPreview);
  if (!preview) return null;
  const title = highlight.title ? sanitizeExhibitText(highlight.title, 60) ?? undefined : undefined;
  return {
    ...highlight,
    title,
    textPreview: preview,
  };
}

function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function sanitizeExhibitPayload(payload: ExhibitPayload): ExhibitPayload {
  const highlights = payload.highlights
    .map(sanitizeHighlight)
    .filter((item): item is ExhibitHighlight => Boolean(item))
    .slice(0, EXHIBIT_LIMITS.highlights);

  const sanitized: ExhibitPayload = {
    ...payload,
    board: {
      ...payload.board,
      title: sanitizeExhibitText(payload.board.title, 60) ?? payload.board.title,
    },
    highlights,
  };

  let size = jsonByteLength(sanitized);
  if (size <= EXHIBIT_LIMITS.payloadBytes) {
    return sanitized;
  }

  let reducedHighlights = [...sanitized.highlights];
  while (size > EXHIBIT_LIMITS.payloadBytes && reducedHighlights.length > 0) {
    reducedHighlights = reducedHighlights.slice(0, Math.max(0, reducedHighlights.length - 4));
    size = jsonByteLength({ ...sanitized, highlights: reducedHighlights });
  }

  let reducedPayload: ExhibitPayload = { ...sanitized, highlights: reducedHighlights };
  size = jsonByteLength(reducedPayload);
  if (size > EXHIBIT_LIMITS.payloadBytes) {
    reducedPayload = {
      ...reducedPayload,
      aggregates: {
        questionsCount: reducedPayload.aggregates.questionsCount,
        helpCount: reducedPayload.aggregates.helpCount,
      },
      timeline: reducedPayload.timeline.slice(0, 3),
    };
  }

  return reducedPayload;
}
