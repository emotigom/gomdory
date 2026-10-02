import { safeStudentText } from "@/lib/safety/safeStudentText";
import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";

const MAX_PAYLOAD_BYTES = 200 * 1024;
const MAX_BOARD_TITLE_LENGTH = 120;
const MAX_BOARD_DESCRIPTION_LENGTH = 400;
const MAX_WALL_TITLE_LENGTH = 60;
const MAX_WALL_DESCRIPTION_LENGTH = 200;
const MAX_CARD_TEXT_LENGTH = 400;
const MAX_CARDS = 60;
const MAX_WALLS = 12;

const BOARD_VIEW_TYPES = ["grid", "wall", "mindmap", "gen"] as const;

const FORBIDDEN_KEYS = [
  "session",
  "record",
  "recording",
  "clip",
  "presence",
  "roster",
  "audit",
  "email",
  "ip",
  "user",
  "author",
];

type BoardViewType = (typeof BOARD_VIEW_TYPES)[number];

type TemplateBoardExport = {
  board?: {
    title?: string | null;
    description?: string | null;
    board_view_type?: string | null;
    theme?: string | null;
    layout?: string | null;
    view_defaults?: {
      studentDefaultView?: string | null;
    } | null;
  };
  walls?: Array<{
    id?: string | null;
    title?: string | null;
    description?: string | null;
    position?: number | null;
  }>;
  cards?: Array<{
    wall_id?: string | null;
    author_type?: "teacher" | "student" | null;
    text?: string | null;
    external_attachments?: ExternalAttachment[] | null;
  }>;
};

export type SanitizedTemplatePayload = {
  meta: {
    payloadVersion: 1;
    generatedAt: string;
  };
  board: {
    title: string;
    description: string | null;
    boardViewType: BoardViewType | null;
    theme: string | null;
    layout: string | null;
    viewDefaults: {
      studentDefaultView: string | null;
    } | null;
  };
  walls: Array<{
    title: string;
    description: string | null;
    position: number;
  }>;
  cards: Array<
    | {
        kind: "text";
        wallIndex: number;
        text: string;
      }
    | {
        kind: "attachment";
        wallIndex: number;
        attachment: {
          filename: string;
          contentType: string | null;
          byteSize: number | null;
          downloadPath: string | null;
        };
      }
  >;
};

function sanitizeOptionalText(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const safe = safeStudentText(value, { maxLength });
  return safe.text;
}

function sanitizeRequiredText(value: string | null | undefined, maxLength: number, fallback: string): string {
  const sanitized = sanitizeOptionalText(value, maxLength);
  if (sanitized) return sanitized;

  const fallbackSafe = safeStudentText(fallback, { maxLength });
  return fallbackSafe.text ?? fallback.slice(0, maxLength);
}

function sanitizeBoardViewType(value: string | null | undefined): BoardViewType | null {
  if (!value) return null;
  const normalized = value.trim();
  return BOARD_VIEW_TYPES.includes(normalized as BoardViewType)
    ? (normalized as BoardViewType)
    : null;
}

function isForbiddenKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return FORBIDDEN_KEYS.some((token) => lowered.includes(token));
}

function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (isForbiddenKey(key)) continue;
    next[key] = stripForbiddenKeys(nested);
  }
  return next;
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

function shrinkPayloadToLimit(payload: SanitizedTemplatePayload): SanitizedTemplatePayload {
  let nextPayload = { ...payload, walls: [...payload.walls], cards: [...payload.cards] };

  while (byteLength(nextPayload) > MAX_PAYLOAD_BYTES && nextPayload.cards.length > 0) {
    nextPayload.cards.pop();
  }

  while (byteLength(nextPayload) > MAX_PAYLOAD_BYTES && nextPayload.walls.length > 1) {
    nextPayload.walls.pop();
    const maxIndex = nextPayload.walls.length - 1;
    nextPayload.cards = nextPayload.cards.filter((card) => card.wallIndex <= maxIndex);
  }

  if (byteLength(nextPayload) > MAX_PAYLOAD_BYTES && nextPayload.board.description) {
    nextPayload = {
      ...nextPayload,
      board: { ...nextPayload.board, description: null },
    };
  }

  if (byteLength(nextPayload) > MAX_PAYLOAD_BYTES) {
    throw new Error("payload exceeds size limit");
  }

  return nextPayload;
}

export function sanitizeTemplatePayload(input: TemplateBoardExport): SanitizedTemplatePayload {
  if (!input || typeof input !== "object") {
    throw new Error("payload is required");
  }

  const board = input.board ?? {};
  const sanitizedBoard = {
    title: sanitizeRequiredText(board.title, MAX_BOARD_TITLE_LENGTH, "새 템플릿 보드"),
    description: sanitizeOptionalText(board.description, MAX_BOARD_DESCRIPTION_LENGTH),
    boardViewType: sanitizeBoardViewType(board.board_view_type),
    theme: sanitizeOptionalText(board.theme, 60),
    layout: sanitizeOptionalText(board.layout, 60),
    viewDefaults: board.view_defaults?.studentDefaultView
      ? { studentDefaultView: sanitizeOptionalText(board.view_defaults.studentDefaultView, 40) }
      : null,
  };

  const walls = (input.walls ?? [])
    .map((wall, index) => {
      const title = sanitizeRequiredText(wall.title, MAX_WALL_TITLE_LENGTH, `담벼락 ${index + 1}`);
      return {
        id: wall.id ?? null,
        title,
        description: sanitizeOptionalText(wall.description, MAX_WALL_DESCRIPTION_LENGTH),
        position: typeof wall.position === "number" ? wall.position : index + 1,
      };
    })
    .slice(0, MAX_WALLS);

  const normalizedWalls = walls.length
    ? walls
    : [{ id: null, title: "생각 모으기", description: null, position: 1 }];

  const wallIndexById = new Map<string, number>();
  normalizedWalls.forEach((wall, index) => {
    if (wall.id) {
      wallIndexById.set(wall.id, index);
    }
  });

  const cards: SanitizedTemplatePayload["cards"] = [];
  for (const card of input.cards ?? []) {
    if (card.author_type && card.author_type !== "teacher") continue;

    const wallIndex = card.wall_id ? wallIndexById.get(card.wall_id) : null;
    if (wallIndex == null) continue;

    const text = sanitizeOptionalText(card.text, MAX_CARD_TEXT_LENGTH);
    if (text) {
      cards.push({ kind: "text", wallIndex, text });
      continue;
    }

    const attachments = normalizeExternalAttachments(card.external_attachments)
      .map((attachment) => ({
        filename: attachment.filename?.slice(0, 120) ?? "",
        contentType: attachment.contentType ?? null,
        byteSize: typeof attachment.byteSize === "number" ? attachment.byteSize : null,
        downloadPath: typeof attachment.downloadPath === "string" ? attachment.downloadPath : null,
      }))
      .filter((attachment) => attachment.filename.length > 0 || Boolean(attachment.downloadPath));

    if (attachments.length > 0) {
      const attachment = attachments[0];
      cards.push({
        kind: "attachment",
        wallIndex,
        attachment,
      });
      continue;
    }
  }

  const trimmedCards = cards.slice(0, MAX_CARDS);

  const payload: SanitizedTemplatePayload = {
    meta: {
      payloadVersion: 1,
      generatedAt: new Date().toISOString(),
    },
    board: sanitizedBoard,
    walls: normalizedWalls.map((wall) => ({
      title: wall.title,
      description: wall.description,
      position: wall.position,
    })),
    cards: trimmedCards,
  };

  const withoutForbiddenKeys = stripForbiddenKeys(payload) as SanitizedTemplatePayload;
  return shrinkPayloadToLimit(withoutForbiddenKeys);
}

export type { TemplateBoardExport };
