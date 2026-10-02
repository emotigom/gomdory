import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeShareCode } from "@/lib/data/share";
import { listSectionCardsV2ForShare, listSectionsV2ForShareCode } from "@/lib/data/shareWallV2";
import { getOrCreateRequestId } from "@/lib/http/requestId";

const DEFAULT_SECTION_CARD_LIMIT = 12;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const requestId = getOrCreateRequestId(request);
  const normalizedCode = normalizeShareCode(code);

  try {
    const shareData = await listSectionsV2ForShareCode(normalizedCode);

    if (!shareData) {
      return jsonErrorWithRequestId(
        "BOARD_NOT_FOUND",
        "공유 보드를 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    const sections = await Promise.all(
      shareData.sections.map(async (section) => {
        const cardsResult = await listSectionCardsV2ForShare({
          sectionId: section.id,
          limit: DEFAULT_SECTION_CARD_LIMIT,
        });

        return {
          section,
          cards: cardsResult.items.map((card) => ({
            id: card.id,
            sectionId: card.section_id,
            authorId: card.author_id,
            position: card.position,
            content: card.content,
            createdAt: card.created_at,
            updatedAt: card.updated_at,
          })),
          nextCursor: cardsResult.nextCursor,
        };
      }),
    );

    return jsonOkWithRequestId(
      {
        board: shareData.board,
        sections,
      },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "섹션 정보를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("FETCH_FAILED", message, requestId, 400);
  }
}
