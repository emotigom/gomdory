import type {
  SharedBoardViewModel,
  SharedCard,
  SharedCardAttachment,
} from "@/lib/boards/toSharedViewModel";

export type StudentSharedCardAttachment = {
  id: string;
  type: "file" | "external";
  label: string;
  url: string;
  contentType?: string | null;
};

export type StudentSharedCard = {
  id: string;
  wallId: string;
  position?: number | null;
  text: string;
  authorType: "teacher" | "student";
  authorName: string | null;
  authorClientId?: string | null;
  createdAt: string;
  isPinned: boolean;
  isFeatured: boolean;
  cardColorToken: string | null;
  attachments: StudentSharedCardAttachment[];
};

export type StudentSharedColumn = {
  id: string;
  title: string;
  uiColorToken: string | null;
  studentWriteEnabled: boolean;
  cards: StudentSharedCard[];
  featuredCards: StudentSharedCard[];
  pinnedCards: StudentSharedCard[];
};

export type StudentSharedBoardViewModel = {
  columns: StudentSharedColumn[];
};

const normalizeAttachment = (attachment: SharedCardAttachment): StudentSharedCardAttachment => ({
  id: String(attachment.id ?? ""),
  type: attachment.type === "file" ? "file" : "external",
  label: String(attachment.label ?? ""),
  url: String(attachment.url ?? ""),
  contentType: attachment.contentType ?? null,
});

const normalizeCard = (card: SharedCard): StudentSharedCard => ({
  id: String(card.id ?? ""),
  wallId: String(card.wallId ?? ""),
  position: typeof card.position === "number" && Number.isFinite(card.position) ? card.position : null,
  text: String(card.text ?? ""),
  authorType: card.authorType === "teacher" ? "teacher" : "student",
  authorName: card.authorName ?? null,
  authorClientId: card.authorClientId ?? null,
  createdAt: String(card.createdAt ?? ""),
  isPinned: Boolean(card.isPinned),
  isFeatured: Boolean(card.isFeatured),
  cardColorToken: card.cardColorToken ?? null,
  attachments: Array.isArray(card.attachments) ? card.attachments.map(normalizeAttachment) : [],
});

const normalizeColumn = (column: SharedBoardViewModel["columns"][number]): StudentSharedColumn => ({
  id: String(column.id ?? ""),
  title: String(column.title ?? ""),
  uiColorToken: column.uiColorToken ?? null,
  studentWriteEnabled: Boolean(column.studentWriteEnabled),
  cards: Array.isArray(column.cards) ? column.cards.map(normalizeCard) : [],
  featuredCards: Array.isArray(column.featuredCards) ? column.featuredCards.map(normalizeCard) : [],
  pinnedCards: Array.isArray(column.pinnedCards) ? column.pinnedCards.map(normalizeCard) : [],
});

export function serializeStudentSharedViewModel(
  viewModel: SharedBoardViewModel,
): StudentSharedBoardViewModel {
  return {
    columns: Array.isArray(viewModel?.columns) ? viewModel.columns.map(normalizeColumn) : [],
  };
}
