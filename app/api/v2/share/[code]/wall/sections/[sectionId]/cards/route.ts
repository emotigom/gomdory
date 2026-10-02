import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeShareCode } from "@/lib/data/share";
import {
  createStudentCardV2,
  listSectionCardsV2ForShare,
  listSectionsV2ForShareCode,
} from "@/lib/data/shareWallV2";
import { getOrCreateRequestId } from "@/lib/http/requestId";

const DEFAULT_SECTION_CARD_LIMIT = 12;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; sectionId: string }> },
) {
  const { code, sectionId } = await params;
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

    const section = shareData.sections.find((item) => item.id === sectionId);

    if (!section) {
      return jsonErrorWithRequestId(
        "SECTION_NOT_FOUND",
        "섹션을 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const limit = Number.isFinite(Number(limitParam))
      ? Math.min(Math.max(Number(limitParam), 1), 200)
      : DEFAULT_SECTION_CARD_LIMIT;

    const cardsResult = await listSectionCardsV2ForShare({
      sectionId: section.id,
      cursor,
      limit,
    });

    return jsonOkWithRequestId(
      {
        items: cardsResult.items.map((card) => ({
          id: card.id,
          sectionId: card.section_id,
          authorId: card.author_id,
          position: card.position,
          content: card.content,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        })),
        nextCursor: cardsResult.nextCursor,
      },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("FETCH_FAILED", message, requestId, 400);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; sectionId: string }> },
) {
  const { code, sectionId } = await params;
  const requestId = getOrCreateRequestId(request);
  const normalizedCode = normalizeShareCode(code);

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text ?? "";

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

    if (shareData.board.class_state === "ended") {
      return jsonErrorWithRequestId("CLASS_ENDED", "수업이 종료되었습니다.", requestId, 403);
    }

    if (!shareData.board.share_write_enabled) {
      return jsonErrorWithRequestId(
        "WRITING_DISABLED",
        "지금은 글쓰기가 잠겨있습니다.",
        requestId,
        403,
      );
    }

    const section = shareData.sections.find((item) => item.id === sectionId);

    if (!section) {
      return jsonErrorWithRequestId(
        "SECTION_NOT_FOUND",
        "섹션을 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    const card = await createStudentCardV2({
      sectionId: section.id,
      content: {
        type: "text",
        text,
      },
    });

    return jsonOkWithRequestId(
      {
        card: {
          id: card.id,
          sectionId: card.section_id,
          authorId: card.author_id,
          position: card.position,
          content: card.content,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        },
      },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드 작성에 실패했습니다.";
    return jsonErrorWithRequestId("CREATE_FAILED", message, requestId, 400);
  }
}
