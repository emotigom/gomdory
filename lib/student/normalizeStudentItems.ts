import type {
  SharedBoardViewModel,
  SharedCard,
  SharedCardAttachment,
} from "@/lib/boards/toSharedViewModel";

export type StudentBoardAttachment = {
  id: string;
  type: "file" | "external";
  label: string;
  url: string;
  contentType?: string | null;
};

export type StudentBoardItemKind =
  | "note"
  | "image"
  | "file"
  | "poll"
  | "question"
  | "help"
  | "link"
  | "notice";

export type StudentBoardItem = {
  id: string;
  title?: string;
  body?: string;
  cardColorToken?: string | null;
  kind: StudentBoardItemKind;
  searchText: string;
  createdAt?: string;
  author?: string;
  attachments: StudentBoardAttachment[];
  columnId?: string;
  columnTitle?: string;
  pinned?: boolean;
};

export type StudentBoardColumn = {
  id: string;
  title: string;
  items: StudentBoardItem[];
};

export type StudentBoardModel = {
  items: StudentBoardItem[];
  pinnedItems: StudentBoardItem[];
  columns: StudentBoardColumn[];
};

const isImageAttachment = (attachment: SharedCardAttachment) =>
  Boolean(
    attachment.contentType?.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(attachment.url),
  );

const toTitleFromText = (text?: string | null) => {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return undefined;
  const [firstLine] = trimmed.split("\n");
  return firstLine || undefined;
};

const resolveKind = (card: SharedCard): StudentBoardItemKind => {
  const normalized = card.text?.toLowerCase() ?? "";
  if (card.attachments.some(isImageAttachment)) {
    return "image";
  }
  if (card.attachments.some((attachment) => attachment.type === "file")) {
    return "file";
  }
  if (normalized.includes("?") || normalized.includes("？") || normalized.includes("질문")) {
    return "question";
  }
  if (normalized.includes("help") || normalized.includes("도움")) {
    return "help";
  }
  if (normalized.includes("poll") || normalized.includes("투표")) {
    return "poll";
  }
  if (normalized.includes("공지") || normalized.includes("notice") || normalized.includes("announcement")) {
    return "notice";
  }
  if (card.attachments.some((attachment) => attachment.type === "external")) {
    return "link";
  }
  return "note";
};

const buildSearchText = (card: SharedCard, title?: string, attachments: StudentBoardAttachment[] = []) => {
  const parts = [
    title,
    card.text,
    card.authorName ?? undefined,
    ...attachments.map((attachment) => attachment.label),
  ]
    .filter(Boolean)
    .join(" ");
  return parts.toLowerCase();
};

const mapCard = (card: SharedCard, columnId: string, columnTitle: string): StudentBoardItem => {
  const attachments = card.attachments.map((attachment) => ({
    id: attachment.id,
    type: attachment.type,
    label: attachment.label,
    url: attachment.url,
    contentType: attachment.contentType ?? null,
  }));
  const title = toTitleFromText(card.text) ?? attachments[0]?.label;

  return {
    id: card.id,
    title,
    body: card.text,
    cardColorToken: card.cardColorToken,
    kind: resolveKind(card),
    searchText: buildSearchText(card, title, attachments),
    createdAt: card.createdAt,
    author: card.authorName ?? "익명",
    attachments,
    columnId,
    columnTitle,
    pinned: card.isPinned,
  };
};

export function normalizeStudentItems(viewModel: SharedBoardViewModel): StudentBoardModel {
  const items: StudentBoardItem[] = [];
  const itemsById = new Map<string, StudentBoardItem>();

  const columns = viewModel.columns.map((column) => {
    const columnItems: StudentBoardItem[] = [];
    const combined = [...column.featuredCards, ...column.pinnedCards, ...column.cards];

    combined.forEach((card) => {
      let item = itemsById.get(card.id);
      if (!item) {
        item = mapCard(card, column.id, column.title);
        itemsById.set(card.id, item);
        items.push(item);
      }
      columnItems.push(item);
    });

    return {
      id: column.id,
      title: column.title,
      items: columnItems,
    };
  });

  const pinnedItems = items.filter((item) => item.pinned);

  return {
    items,
    pinnedItems,
    columns,
  };
}
