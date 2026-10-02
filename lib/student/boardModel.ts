import type {
  SharedBoardViewModel,
  SharedCard,
  SharedCardAttachment,
} from "@/lib/boards/toSharedViewModel";
import type {
  StudentSharedBoardViewModel,
  StudentSharedCard,
  StudentSharedCardAttachment,
} from "@/lib/student/serializeSharedViewModel";
import type { TriageItem } from "@/lib/types/triage";

export type StudentCardKind =
  | "note"
  | "file"
  | "question"
  | "help"
  | "poll"
  | "pulse"
  | "link";

export type StudentCardMeta = Record<string, unknown> & {
  pinned?: boolean;
  position?: number | null;
  authorType?: "teacher" | "student";
  authorClientId?: string | null;
  attachments?: SharedCardAttachment[];
  fileUrl?: string;
  fileName?: string;
  linkUrl?: string;
  hasImage?: boolean;
};

export type StudentCard = {
  id: string;
  kind: StudentCardKind;
  title?: string;
  text?: string;
  cardColorToken?: string | null;
  createdAt: string;
  authorLabel?: string;
  thumbUrl?: string;
  columnKey?: string;
  meta?: StudentCardMeta;
};

export type StudentBoardColumn = {
  key: string;
  title: string;
  cards: StudentCard[];
  studentWriteEnabled?: boolean;
  uiColorToken?: string | null;
};

export type StudentBoardModel = {
  cards: StudentCard[];
  pinnedCards: StudentCard[];
  columns: StudentBoardColumn[];
};

type StudentBoardOptions = {
  triageItems?: TriageItem[];
};

type StudentBoardViewModel = SharedBoardViewModel | StudentSharedBoardViewModel;
type StudentCardSource = SharedCard | StudentSharedCard;
type StudentCardAttachmentSource = SharedCardAttachment | StudentSharedCardAttachment;

const DEFAULT_COLUMN_MAP: Array<{ key: string; title: string; kinds: StudentCardKind[] }> = [
  { key: "question", title: "질문", kinds: ["question", "poll"] },
  { key: "help", title: "도움요청", kinds: ["help"] },
  { key: "resources", title: "자료", kinds: ["file", "link"] },
  { key: "notes", title: "메모", kinds: ["note", "pulse"] },
];

const isImageAttachment = (attachment: StudentCardAttachmentSource) =>
  Boolean(
    attachment.contentType?.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(attachment.url),
  );

const getPrimaryFile = (card: StudentCardSource) =>
  card.attachments.find((attachment) => attachment.type === "file") ?? null;

const getPrimaryLink = (card: StudentCardSource) =>
  card.attachments.find((attachment) => attachment.type === "external") ?? null;

const getPrimaryImage = (card: StudentCardSource) =>
  card.attachments.find(isImageAttachment) ?? null;

const toTitleFromText = (text?: string | null) => {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return undefined;
  const [firstLine] = trimmed.split("\n");
  return firstLine || undefined;
};

const resolveKind = (card: StudentCardSource): StudentCardKind => {
  const normalized = card.text?.toLowerCase() ?? "";
  if (normalized.includes("poll") || normalized.includes("투표")) {
    return "poll";
  }
  if (normalized.includes("pulse")) {
    return "pulse";
  }
  if (normalized.includes("help") || normalized.includes("도움")) {
    return "help";
  }
  if (normalized.includes("?") || normalized.includes("？") || normalized.includes("질문")) {
    return "question";
  }
  if (getPrimaryFile(card) || getPrimaryImage(card)) {
    return "file";
  }
  if (getPrimaryLink(card)) {
    return "link";
  }
  return "note";
};

const getSafeUrl = (url?: string | null) => {
  if (!url) return undefined;
  return url.startsWith("/") ? url : undefined;
};

const mapCard = (card: StudentCardSource, columnKey?: string): StudentCard => {
  const file = getPrimaryFile(card);
  const link = getPrimaryLink(card);
  const image = getPrimaryImage(card);
  const kind = resolveKind(card);
  const title = toTitleFromText(card.text) ?? file?.label ?? link?.label;

  return {
    id: card.id,
    kind,
    title,
    text: card.text ?? undefined,
    cardColorToken: card.cardColorToken ?? null,
    createdAt: card.createdAt ?? new Date().toISOString(),
    authorLabel: card.authorName ?? "학생",
    thumbUrl: getSafeUrl(image?.url),
    columnKey,
    meta: {
      pinned: card.isPinned ?? false,
      position: "position" in card ? card.position ?? null : null,
      authorType: card.authorType,
      authorClientId: card.authorClientId ?? null,
      attachments: card.attachments,
      fileUrl: getSafeUrl(file?.url),
      fileName: file?.label,
      linkUrl: getSafeUrl(link?.url),
      hasImage: Boolean(getSafeUrl(image?.url)),
    },
  };
};

const buildDerivedColumns = (cards: StudentCard[]): StudentBoardColumn[] =>
  DEFAULT_COLUMN_MAP.map((column) => ({
    key: column.key,
    title: column.title,
    cards: cards.filter((card) => column.kinds.includes(card.kind)),
  })).filter((column) => column.cards.length > 0);

function mapTriageItem(item: TriageItem): StudentCard | null {
  if (item.status !== "approved") return null;
  const trimmedText = item.text?.trim();
  if (!trimmedText) return null;
  return {
    id: item.id,
    kind: item.kind,
    title: toTitleFromText(item.text),
    text: item.text,
    createdAt: item.createdAt,
    authorLabel: item.authorLabel ?? "학생",
    meta: {
      pinned: item.pinned,
    },
  };
}

export function toStudentBoardModel(
  viewModel: StudentBoardViewModel,
  options?: StudentBoardOptions,
): StudentBoardModel {
  const allCards: StudentCard[] = [];
  const cardsById = new Map<string, StudentCard>();
  const triageCards =
    options?.triageItems
      ?.map(mapTriageItem)
      .filter((card): card is StudentCard => Boolean(card)) ?? [];

  triageCards.forEach((card) => {
    cardsById.set(card.id, card);
    allCards.push(card);
  });
  const columnsSource = (viewModel?.columns ?? []).map((column) => ({
    key: column.id,
    title: column.title || "컬럼",
    cards: [...column.featuredCards, ...column.pinnedCards, ...column.cards],
    studentWriteEnabled: column.studentWriteEnabled,
    uiColorToken: column.uiColorToken,
  }));

  columnsSource.forEach((column) => {
    column.cards.forEach((card) => {
      if (!card) return;
      const existing = cardsById.get(card.id);
      if (existing) {
        if (!existing.columnKey) {
          existing.columnKey = column.key;
        }
        return;
      }
      const mapped = mapCard(card, column.key);
      cardsById.set(card.id, mapped);
      allCards.push(mapped);
    });
  });

  const pinnedCards = allCards.filter((card) => Boolean(card.meta?.pinned));
  const cards = allCards.filter((card) => !card.meta?.pinned);

  const baseColumns = columnsSource.length
    ? columnsSource
        .map((column) => ({
          key: column.key,
          title: column.title,
          cards: cards.filter((card) => card.columnKey === column.key),
        }))
        .filter((column) => column.cards.length > 0)
    : buildDerivedColumns(cards);
  const triageColumns = triageCards.length ? buildDerivedColumns(triageCards) : [];
  const columns = columnsSource.length ? [...baseColumns, ...triageColumns] : baseColumns;

  return {
    cards,
    pinnedCards,
    columns,
  };
}
