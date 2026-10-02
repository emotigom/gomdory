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

const MAX_LIMIT = 12;
const DEFAULT_LIMIT = 9;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; wallId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  const { code, wallId } = await params;
  const { normalizedCode, board, wall } = await resolvePublicShareWall({ code, wallId });

  if (!board) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "공유 보드를 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (!wall) {
    return jsonErrorWithRequestId(
      "WALL_NOT_FOUND",
      "담벼락을 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  try {
    const [featured, pinned, totalCount] = await Promise.all([
      listCardsForSharePaged(wall.id, { section: "featured", limit: 3 }),
      listCardsForSharePaged(wall.id, { section: "pinned", limit: 3 }),
      countCardsForShare(wall.id),
    ]);

    const normalLimit = (() => {
      const remaining = limit - featured.items.length - pinned.items.length;
      if (remaining > 0) return remaining;
      return limit;
    })();

    const normalizedNormal = await listWallCardsPaginatedForShare({
      wallId: wall.id,
      cursor,
      limit: normalLimit,
    });

    const allCards = [...featured.items, ...pinned.items, ...normalizedNormal.items];
    const files = await listReadyFilesForCards(allCards.map((card) => card.id));
    const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
      acc[file.cardId] = acc[file.cardId] ?? [];
      acc[file.cardId]?.push(file);
      return acc;
    }, {});

    return jsonOkWithRequestId(
      {
        wall: {
          wall,
          cards: allCards.map((card) => ({
            id: card.id,
            wallId: wall.id,
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
          nextCursor: normalizedNormal.nextCursor,
          totalCount,
        },
      },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "담벼락을 불러오지 못했습니다.";
    return jsonErrorWithRequestId("WALL_FEED_FAILED", message, requestId, 400);
  }
}
