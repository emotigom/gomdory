import type {
  SharedBoardViewModel,
  SharedCard as LegacySharedCard,
  SharedCardAttachment,
} from "@/lib/boards/toSharedViewModel";

export type SharedCard = {
  id: string;
  type: "text" | "image" | "link" | "file" | "poll" | "question" | "help";
  title?: string;
  text?: string;
  media?: { url?: string; thumbUrl?: string; mime?: string };
  meta?: { createdAt?: string; authorLabel?: string; pinned?: boolean };
  columnKey?: string;
};

export type SharedCardColumn = {
  key: string;
  title: string;
  cards: SharedCard[];
};

export type SharedCardsModel = {
  cards: SharedCard[];
  pinnedCards: SharedCard[];
  columns: SharedCardColumn[];
};

const COLUMN_TITLES: Record<string, string> = {
  pinned: "고정",
  posts: "게시물",
  question: "질문",
  help: "도움 요청",
  poll: "투표",
};

const COLUMN_ORDER = ["posts", "question", "help", "poll"] as const;

const isImageAttachment = (attachment: SharedCardAttachment) =>
  Boolean(
    attachment.contentType?.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(attachment.url),
  );

const getPrimaryImage = (card: LegacySharedCard) =>
  card.attachments.find(isImageAttachment) ?? null;

const getPrimaryLink = (card: LegacySharedCard) =>
  card.attachments.find((attachment) => attachment.type === "external") ?? null;

const getPrimaryFile = (card: LegacySharedCard) =>
  card.attachments.find((attachment) => attachment.type === "file") ?? null;

const resolveCardType = (card: LegacySharedCard): SharedCard["type"] => {
  const normalized = card.text?.toLowerCase() ?? "";
  if (normalized.includes("?") || normalized.includes("？") || normalized.includes("질문")) {
    return "question";
  }
  if (normalized.includes("help") || normalized.includes("도움")) {
    return "help";
  }
  if (normalized.includes("poll") || normalized.includes("투표")) {
    return "poll";
  }
  if (getPrimaryImage(card)) {
    return "image";
  }
  if (getPrimaryLink(card)) {
    return "link";
  }
  if (getPrimaryFile(card)) {
    return "file";
  }
  return "text";
};

const resolveColumnKey = (card: SharedCard): string => {
  if (card.meta?.pinned) return "pinned";
  if (card.type === "question" || card.type === "help" || card.type === "poll") {
    return card.type;
  }
  return "posts";
};

const toTitleFromText = (text?: string) => {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return undefined;
  const [firstLine] = trimmed.split("\n");
  return firstLine || undefined;
};

const mapCard = (card: LegacySharedCard): SharedCard => {
  const image = getPrimaryImage(card);
  const link = getPrimaryLink(card);
  const file = getPrimaryFile(card);
  const type = resolveCardType(card);
  const title = toTitleFromText(card.text) ?? link?.label ?? file?.label;

  const media = image
    ? { url: image.url, thumbUrl: image.url, mime: image.contentType ?? undefined }
    : link
      ? { url: link.url, mime: "text/url" }
      : file
        ? { url: file.url, mime: file.contentType ?? undefined }
        : undefined;

  const mapped: SharedCard = {
    id: card.id,
    type,
    title,
    text: card.text,
    media,
    meta: {
      createdAt: card.createdAt,
      authorLabel: card.authorName ?? "익명",
      pinned: card.isPinned,
    },
  };

  mapped.columnKey = resolveColumnKey(mapped);
  return mapped;
};

export function toSharedCardsModel(viewModel: SharedBoardViewModel): SharedCardsModel {
  const cards = viewModel.columns.flatMap((column) => [
    ...column.featuredCards,
    ...column.pinnedCards,
    ...column.cards,
  ]);

  const normalizedCards = cards.map(mapCard);
  const pinnedCards = normalizedCards.filter((card) => card.meta?.pinned);
  const nonPinnedCards = normalizedCards.filter((card) => !card.meta?.pinned);

  const columns = COLUMN_ORDER.map((key) => ({
    key,
    title: COLUMN_TITLES[key],
    cards: nonPinnedCards.filter((card) => card.columnKey === key),
  })).filter((column) => column.cards.length > 0);

  return {
    cards: nonPinnedCards,
    pinnedCards,
    columns,
  };
}
