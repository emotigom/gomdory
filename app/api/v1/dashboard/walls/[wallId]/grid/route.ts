import { apiV1Path } from "@/lib/standards/pathTypes";

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { countCardsByWall, listCardsForWallPaged, listWallCardsPaginated } from "@/lib/data/cards";
import { listFilesByCardIds } from "@/lib/data/files";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getWall } from "@/lib/data/walls";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ wallId: string }> },
) {
  const { wallId } = await params;
  const requestId = getOrCreateRequestId(request);
  await requireUser("/dashboard");

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId") ?? "";
  const includeHiddenParam = searchParams.get("includeHidden");

  if (!boardId.trim()) {
    return NextResponse.json(
      { ok: false, error: "boardId 값이 필요합니다." },
      { status: 400 },
    );
  }

  const includeHidden = includeHiddenParam
    ? includeHiddenParam === "true" || includeHiddenParam === "1"
    : true;

  const wall = await getWall(boardId, wallId);

  if (!wall) {
    return NextResponse.json(
      { ok: false, error: "담벼락을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { searchParams: reloadParams } = new URL(request.url);
  const limitParam = reloadParams.get("limit");
  const limit = Number.isFinite(Number(limitParam))
    ? Math.min(Math.max(Number(limitParam), 1), 200)
    : 40;

  try {
    const [featuredCardsResult, pinnedCardsResult, normalCardsResult, totalCount] =
      await Promise.all([
        listCardsForWallPaged({
          wallId: wall.id,
          includeHidden,
          section: "featured",
          limit: 200,
        }),
        listCardsForWallPaged({
          wallId: wall.id,
          includeHidden,
          section: "pinned",
          limit: 200,
        }),
        listWallCardsPaginated({ wallId: wall.id, includeHidden, limit }),
        countCardsByWall(wall.id),
      ]);

    const featuredCards = featuredCardsResult.items;
    const pinnedCards = pinnedCardsResult.items;
    const normalCards = normalCardsResult.items;
    const allCards = [...featuredCards, ...pinnedCards, ...normalCards];
    const filesByCard = await listFilesByCardIds(allCards.map((card) => card.id));

    const data = {
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
        isHidden: card.is_hidden,
        isPinned: card.is_pinned,
        isFeatured: card.is_featured,
        cardColorToken: card.card_color_token,
        hasAttachments:
          (filesByCard[card.id]?.length ?? 0) > 0 ||
          (card.external_attachments?.length ?? 0) > 0,
      })),
      pinnedCards: pinnedCards.map((card) => ({
        id: card.id,
        wallId: wall.id,
        text: card.text,
        authorName: card.author_name,
        createdAt: card.created_at,
        isHidden: card.is_hidden,
        isPinned: card.is_pinned,
        isFeatured: card.is_featured,
        cardColorToken: card.card_color_token,
        hasAttachments:
          (filesByCard[card.id]?.length ?? 0) > 0 ||
          (card.external_attachments?.length ?? 0) > 0,
      })),
      cards: normalCards.map((card) => ({
        id: card.id,
        wallId: wall.id,
        text: card.text,
        authorName: card.author_name,
        createdAt: card.created_at,
        isHidden: card.is_hidden,
        isPinned: card.is_pinned,
        isFeatured: card.is_featured,
        cardColorToken: card.card_color_token,
        hasAttachments:
          (filesByCard[card.id]?.length ?? 0) > 0 ||
          (card.external_attachments?.length ?? 0) > 0,
      })),
      nextCursor: normalCardsResult.nextCursor,
      totalCount,
      cardsIndex: allCards.map((card) => ({
        id: card.id,
        text: card.text,
        authorName: card.author_name,
        authorType: card.author_type ?? undefined,
        createdAt: card.created_at,
        isHidden: card.is_hidden,
        isPinned: card.is_pinned,
        isFeatured: card.is_featured,
        cardColorToken: card.card_color_token,
        files: (filesByCard[card.id] ?? []).map((file) => ({
          id: file.id,
          filename: file.filename,
          contentType: file.content_type,
          sizeBytes: file.size_bytes,
          downloadUrl: apiV1Path(`files/${file.id}/download`),
        })),
        externalAttachments: card.external_attachments,
      })),
    };
    const schemaVersion = SCHEMA_VERSIONS.dashboardWallGrid;
    const contractHash = computeContractHash(data);
    return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 불러오지 못했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
