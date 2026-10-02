import { apiV1Path } from "@/lib/standards/pathTypes";

import {
  countCardsForShare,
  listCardsForSharePaged,
  listWallCardsPaginatedForShare,
} from "@/lib/data/share";
import { listReadyFilesForCards } from "@/lib/data/files";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { resolvePublicShareWall } from "@/lib/share/public/access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; wallId: string }> },
) {
  const { code, wallId } = await params;
  const requestId = getOrCreateRequestId(request);
  const { normalizedCode, board, wall } = await resolvePublicShareWall({ code, wallId });

  if (!board) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "공유 보드를 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  if (!wall) {
    return jsonErrorWithRequestId(
      "WALL_NOT_FOUND",
      "담벼락을 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = Number.isFinite(Number(limitParam))
    ? Math.min(Math.max(Number(limitParam), 1), 200)
    : 40;

  try {
    const [featuredCardsResult, pinnedCardsResult, normalCardsResult, totalCount] =
      await Promise.all([
        listCardsForSharePaged(wall.id, { section: "featured", limit: 200 }),
        listCardsForSharePaged(wall.id, { section: "pinned", limit: 200 }),
        listWallCardsPaginatedForShare({ wallId: wall.id, limit }),
        countCardsForShare(wall.id),
      ]);

    const featuredCards = featuredCardsResult.items;
    const pinnedCards = pinnedCardsResult.items;
    const normalCards = normalCardsResult.items;
    const allCards = [...featuredCards, ...pinnedCards, ...normalCards];
    const files = await listReadyFilesForCards(allCards.map((card) => card.id));
    const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
      acc[file.cardId] = acc[file.cardId] ?? [];
      acc[file.cardId]?.push(file);
      return acc;
    }, {});

    return jsonOkWithRequestId(
      {
        wall: {
          id: wall.id,
          title: wall.title,
          description: wall.description,
        },
        featuredCards: featuredCards.map((card) => ({
          id: card.id,
          wallId: wall.id,
          text: card.text,
          authorName: card.author_name,
          createdAt: card.created_at,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          hasAttachments:
            (filesByCardId[card.id]?.length ?? 0) > 0 ||
            (card.external_attachments?.length ?? 0) > 0,
        })),
        pinnedCards: pinnedCards.map((card) => ({
          id: card.id,
          wallId: wall.id,
          text: card.text,
          authorName: card.author_name,
          createdAt: card.created_at,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          hasAttachments:
            (filesByCardId[card.id]?.length ?? 0) > 0 ||
            (card.external_attachments?.length ?? 0) > 0,
        })),
        cards: normalCards.map((card) => ({
          id: card.id,
          wallId: wall.id,
          text: card.text,
          authorName: card.author_name,
          createdAt: card.created_at,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          hasAttachments:
            (filesByCardId[card.id]?.length ?? 0) > 0 ||
            (card.external_attachments?.length ?? 0) > 0,
        })),
        nextCursor: normalCardsResult.nextCursor,
        totalCount,
        cardsIndex: allCards.map((card) => ({
          id: card.id,
          text: card.text,
          authorName: card.author_name,
          authorType: card.author_type,
          createdAt: card.created_at,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          files: (filesByCardId[card.id] ?? []).map((file) => ({
            id: file.fileId,
            filename: file.filename,
            contentType: file.contentType,
            sizeBytes: file.byteSize,
            downloadUrl: apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`),
          })),
          externalAttachments: card.external_attachments,
        })),
      },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("FETCH_FAILED", message, requestId, 400);
  }
}
