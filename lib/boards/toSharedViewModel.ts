import { apiV1Path } from "@/lib/standards/pathTypes";

import { listReadyFilesForCards } from "@/lib/data/files";
import {
  countCardsForShare,
  listCardsForSharePaged,
  listWallCardsPaginatedForShare,
  listWallsForShare,
} from "@/lib/data/share";

export type SharedCardAttachment = {
  id: string;
  type: "file" | "external";
  label: string;
  url: string;
  contentType?: string | null;
};

export type SharedCard = {
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
  attachments: SharedCardAttachment[];
};

export type SharedColumn = {
  id: string;
  title: string;
  description: string | null;
  uiColorToken: string | null;
  studentWriteEnabled: boolean;
  cards: SharedCard[];
  featuredCards: SharedCard[];
  pinnedCards: SharedCard[];
  totalCount: number;
};

export type SharedBoardViewModel = {
  columns: SharedColumn[];
};

export async function toSharedViewModel(boardId: string, shareCode: string): Promise<SharedBoardViewModel> {
  const walls = await listWallsForShare(boardId);
  const wallCards = await Promise.all(
    walls.map(async (wall) => {
      const [featuredCards, pinnedCards, normalCards, totalCount] = await Promise.all([
        listCardsForSharePaged(wall.id, { section: "featured", limit: 200 }),
        listCardsForSharePaged(wall.id, { section: "pinned", limit: 200 }),
        listWallCardsPaginatedForShare({ wallId: wall.id, limit: 200 }),
        countCardsForShare(wall.id),
      ]);

      const allCards = [...featuredCards.items, ...pinnedCards.items, ...normalCards.items];
      const files = await listReadyFilesForCards(allCards.map((card) => card.id));
      const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
        acc[file.cardId] = acc[file.cardId] ?? [];
        acc[file.cardId]?.push(file);
        return acc;
      }, {});

      const normalizeAttachments = (cardId: string, externalAttachments?: { url?: string; title?: string }[]) => {
        const fileAttachments = (filesByCardId[cardId] ?? []).map((file) => ({
          id: file.fileId,
          type: "file" as const,
          label: file.filename,
          url: apiV1Path(`share/${shareCode}/files/${file.fileId}/download`),
          contentType: file.contentType,
        }));

        const external = (externalAttachments ?? [])
          .filter((attachment) => Boolean(attachment.url))
          .map((attachment, index) => ({
            id: `${cardId}-ext-${index}`,
            type: "external" as const,
            label: attachment.title || attachment.url || "링크",
            url: attachment.url ?? "#",
          }));

        return [...fileAttachments, ...external];
      };

      const mapCard = (card: (typeof allCards)[number]): SharedCard => ({
        id: card.id,
        wallId: wall.id,
        position: (card as { position?: number | null }).position ?? null,
        text: card.text,
        authorType: (card.author_type ?? "teacher") as "teacher" | "student",
        authorName: card.author_name,
        authorClientId: (card as { author_client_id?: string | null }).author_client_id ?? null,
        createdAt: card.created_at,
        isPinned: card.is_pinned,
        isFeatured: card.is_featured,
        cardColorToken: card.card_color_token,
        attachments: normalizeAttachments(card.id, card.external_attachments),
      });

      return {
        wall,
        featuredCards: featuredCards.items.map(mapCard),
        pinnedCards: pinnedCards.items.map(mapCard),
        cards: normalCards.items.map(mapCard),
        totalCount,
      };
    }),
  );

  const columns = wallCards.map((column) => ({
    id: column.wall.id,
    title: column.wall.title,
    description: column.wall.description,
    uiColorToken: column.wall.ui_color_token,
    studentWriteEnabled: column.wall.student_write_enabled,
    cards: column.cards,
    featuredCards: column.featuredCards,
    pinnedCards: column.pinnedCards,
    totalCount: column.totalCount,
  }));

  return { columns };
}
