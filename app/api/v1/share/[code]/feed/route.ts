import {
  countCardsForShare,
  listCardsForSharePaged,
  listWallCardsPaginatedForShare,
  listWallsForShare,
} from "@/lib/data/share";
import { listReadyFilesForCards } from "@/lib/data/files";
import { jsonOperationalError, jsonOperationalOk } from "@/lib/api/server/operational";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { resolvePublicShareBoard } from "@/lib/share/public/access";
import { routes } from "@/lib/standards/routes";

const MAX_LIMIT = 12;
const DEFAULT_LIMIT = 9;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const requestId = getOrCreateRequestId(request);
  const { normalizedCode, board } = await resolvePublicShareBoard(code);

  if (!board) {
    return jsonOperationalError("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const walls = await listWallsForShare(board.id);
    const wallPayloads = await Promise.all(
      walls.map(async (wall) => {
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
          limit: normalLimit,
        });

        const allCards = [...featured.items, ...pinned.items, ...normalizedNormal.items];
        const files = await listReadyFilesForCards(allCards.map((card) => card.id));
        const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
          acc[file.cardId] = acc[file.cardId] ?? [];
          acc[file.cardId]?.push(file);
          return acc;
        }, {});

        return {
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
              downloadUrl: routes.api.share.files.download(normalizedCode, file.fileId),
            })),
            externalAttachments: card.external_attachments,
          })),
          nextCursor: normalizedNormal.nextCursor,
          totalCount,
        };
      }),
    );

    const data = { board, walls: wallPayloads };
    return jsonOperationalOk(
      { schemaVersion: SCHEMA_VERSIONS.shareFeed, contractHash: computeContractHash(data), ...data },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "피드를 불러오지 못했습니다.";
    return jsonOperationalError("FEED_FAILED", message, requestId, 400);
  }
}
