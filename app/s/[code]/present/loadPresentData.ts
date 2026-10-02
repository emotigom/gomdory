import { apiV1Path } from "@/lib/standards/pathTypes";

import { listCardsForShare, listWallsForShare } from "@/lib/data/share";
import type { CardTag } from "@/lib/data/cards";
import { listReadyFilesForCards } from "@/lib/data/files";
import type { ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";
import { digestHex } from "@/lib/crypto/webcrypto";
import { resolvePublicShareBoard } from "@/lib/share/public/access";

export type PresentCard = {
  id: string;
  wallId: string;
  wallTitle: string;
  wallPosition: number;
  text: string;
  authorName: string | null;
  authorType: "teacher" | "student";
  createdAt: string;
  isPinned: boolean;
  isFeatured: boolean;
  cardColorToken: CardColorToken | null;
  tags: CardTag[];
  attachmentsCount: number;
  files: Array<{
    id: string;
    filename: string;
    downloadUrl: string;
  }>;
  externalAttachments: ExternalAttachment[];
};

export type PresentSnapshot = {
  ok: true;
  board: {
    id: string;
    title: string;
    classState: "idle" | "live" | "ended";
    classNotice: string | null;
    shareCode: string | null;
    rulesText: string | null;
    toolsEnabled: string[] | null;
  };
  walls: Array<{
    id: string;
    title: string;
    position: number;
  }>;
  selectedWallId: string | null;
  cards: PresentCard[];
  version: string;
  fetchedAt: string;
};

export async function loadPresentSnapshot(code: string, wallId?: string | null) {
  const { normalizedCode, board } = await resolvePublicShareBoard(code);

  if (!board) {
    return null;
  }

  const walls = await listWallsForShare(board.id);
  const sortedWalls = walls
    .map((wall) => ({ id: wall.id, title: wall.title, position: wall.position }))
    .sort((a, b) => a.position - b.position);
  const selectedWall =
    wallId && sortedWalls.some((wall) => wall.id === wallId)
      ? sortedWalls.find((wall) => wall.id === wallId)
      : null;
  const activeWalls = selectedWall ? [selectedWall] : sortedWalls;

  const wallCards = await Promise.all(
    activeWalls.map(async (wall) => {
      const cards = await listCardsForShare(wall.id, { order: "asc" });
      return { wall, cards };
    }),
  );

  const allCards = wallCards.flatMap(({ cards }) => cards);
  const files = await listReadyFilesForCards(allCards.map((card) => card.id));
  const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
    acc[file.cardId] = acc[file.cardId] ?? [];
    acc[file.cardId]?.push(file);
    return acc;
  }, {});

  const cards: PresentCard[] = wallCards
    .flatMap(({ wall, cards }) =>
      cards.map((card) => {
        const cardFiles = filesByCardId[card.id] ?? [];
        const attachmentsCount = cardFiles.length + (card.external_attachments?.length ?? 0);

        return {
          id: card.id,
          wallId: wall.id,
          wallTitle: wall.title,
          wallPosition: wall.position,
          text: card.text,
          authorName: card.author_name,
          authorType: card.author_type,
          createdAt: card.created_at,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          tags: card.tags ?? [],
          attachmentsCount,
          files: cardFiles.map((file) => ({
            id: file.fileId,
            filename: file.filename,
            downloadUrl: apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`),
          })),
          externalAttachments: card.external_attachments ?? [],
        };
      }),
    )
    .sort((a, b) => {
      if (a.wallPosition !== b.wallPosition) {
        return a.wallPosition - b.wallPosition;
      }
      if (a.isFeatured !== b.isFeatured) {
        return a.isFeatured ? -1 : 1;
      }
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const versionSource = JSON.stringify(
    cards.map((card) => ({
      id: card.id,
      text: card.text,
      isPinned: card.isPinned,
      isFeatured: card.isFeatured,
      color: card.cardColorToken,
      tags: (card.tags ?? []).map((tag) => `${tag.id}:${tag.name}:${tag.color}`),
      attachments: card.attachmentsCount,
      wall: card.wallId,
    })),
  );
  const version = await digestHex("SHA-1", versionSource);

  const snapshot: PresentSnapshot = {
    ok: true,
    board: {
      id: board.id,
      title: board.title,
      classState: board.class_state,
      classNotice: board.class_notice,
      shareCode: board.share_code,
      rulesText: board.rules_text,
      toolsEnabled: board.tools_enabled ?? null,
    },
    walls: sortedWalls,
    selectedWallId: selectedWall?.id ?? null,
    cards,
    version,
    fetchedAt: new Date().toISOString(),
  };

  return snapshot;
}
