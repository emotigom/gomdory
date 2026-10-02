import "server-only";

import { safeStudentText } from "@/lib/safety/safeStudentText";
import type { TemplateBoardExport } from "@/lib/templates/sanitizeTemplatePayload";

const MAX_TITLE_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 240;
const MAX_CARD_TEXT_LENGTH = 400;
const MAX_TAG_LENGTH = 24;

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;

const FORBIDDEN_TOKENS = [
  "token",
  "secret",
  "shortcode",
  "sharecode",
  "object_key",
  "content_hash",
];

export type TemplateCardAttachment = {
  kind: "image" | "file_ref";
  refId?: string | null;
};

export type TemplateCard = {
  type: "text" | "attachment";
  text?: string | null;
  columnIndex?: number | null;
  style?: Record<string, unknown> | null;
  attachments?: TemplateCardAttachment[] | null;
};

export type TemplatePayload = {
  kind: "board_template";
  schemaVersion: 1;
  title: string;
  description?: string | null;
  tags?: string[];
  board: {
    layoutType: string | null;
    columns?: number | null;
    wall?: string | null;
    cards: TemplateCard[];
  };
  presets?: Record<string, unknown> | null;
  flows?: Record<string, unknown> | null;
};

export type TemplatePreview = {
  cardCount: number;
  columnCount: number;
  keywords: string[];
  thumbnail: string | null;
};

function containsForbiddenToken(value: string): boolean {
  const lowered = value.toLowerCase();
  return FORBIDDEN_TOKENS.some((token) => lowered.includes(token));
}

function ensureNoPii(value: string) {
  if (EMAIL_REGEX.test(value) || PHONE_REGEX.test(value)) {
    throw new Error("PII detected in template payload");
  }
  if (containsForbiddenToken(value)) {
    throw new Error("Sensitive tokens detected in template payload");
  }
}

function sanitizeText(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const safe = safeStudentText(trimmed, { maxLength });
  if (!safe.text) return null;
  ensureNoPii(safe.text);
  return safe.text;
}

function sanitizeRequired(value: string | null | undefined, maxLength: number, fallback: string): string {
  const sanitized = sanitizeText(value, maxLength);
  if (sanitized) return sanitized;
  const safe = safeStudentText(fallback, { maxLength });
  return safe.text ?? fallback.slice(0, maxLength);
}

function sanitizeTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
  return Array.from(new Set(cleaned));
}

export function sanitizeTemplatePayload(
  input: TemplateBoardExport,
  options: {
    title: string;
    description?: string | null;
    tags?: string[];
  },
): TemplatePayload {
  if (!input || typeof input !== "object") {
    throw new Error("template payload is required");
  }

  const title = sanitizeRequired(options.title, MAX_TITLE_LENGTH, "새 템플릿");
  const description = sanitizeText(options.description ?? null, MAX_DESCRIPTION_LENGTH);
  const tags = sanitizeTags(options.tags);

  const layoutType = sanitizeText(input.board?.board_view_type ?? null, 20);

  const walls = (input.walls ?? [])
    .map((wall) => ({ id: wall.id ?? null }))
    .filter((wall) => wall.id);
  const wallIndexById = new Map<string, number>();
  walls.forEach((wall, index) => {
    if (wall.id) wallIndexById.set(wall.id, index);
  });

  const cards: TemplateCard[] = [];
  for (const card of input.cards ?? []) {
    if (card.author_type && card.author_type !== "teacher") continue;

    const wallIndex = card.wall_id ? wallIndexById.get(card.wall_id) : null;
    const text = sanitizeText(card.text ?? null, MAX_CARD_TEXT_LENGTH);

    if (text) {
      cards.push({ type: "text", text, columnIndex: wallIndex ?? null });
      continue;
    }

    if (card.external_attachments && card.external_attachments.length > 0) {
      cards.push({
        type: "attachment",
        text: "첨부 자료",
        columnIndex: wallIndex ?? null,
        attachments: [{ kind: "file_ref", refId: null }],
      });
    }
  }

  return {
    kind: "board_template",
    schemaVersion: 1,
    title,
    description,
    tags,
    board: {
      layoutType,
      columns: input.walls?.length ?? 1,
      wall: null,
      cards,
    },
    presets: null,
    flows: null,
  };
}

function extractKeywords(payload: TemplatePayload): string[] {
  if (payload.tags && payload.tags.length > 0) {
    return payload.tags.slice(0, 3);
  }

  const tokens = [payload.title, payload.description ?? ""]
    .join(" ")
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);

  return Array.from(new Set(tokens)).slice(0, 3);
}

export function buildTemplatePreview(payload: TemplatePayload): TemplatePreview {
  return {
    cardCount: payload.board.cards.length,
    columnCount: payload.board.columns ?? 1,
    keywords: extractKeywords(payload),
    thumbnail: null,
  };
}
