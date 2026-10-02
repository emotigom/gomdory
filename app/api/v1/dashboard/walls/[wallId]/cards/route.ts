import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import { decodeCardCursor, listWallCardsPaginated, createCard } from "@/lib/data/cards";
import { listFilesByCardIds } from "@/lib/data/files";
import { getWall } from "@/lib/data/walls";
import { logAudit } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { routes } from "@/lib/standards/routes";
import { normalizeExternalAttachments } from "@/lib/types/attachments";
import { recordAuditEvent } from "@/lib/data/auditEvents";
import { bumpBoardAndWallActivityByWallId, shouldBumpActivity } from "@/lib/db/activityBump";
import { isQ2B6FixtureAuthorized, q2B6CreateCard, q2B6Walls } from "@/lib/q2/browser/teacherPreparationFixture";

const DEFAULT_CARDS_LIMIT = 40;
const MAX_CARDS_LIMIT = 200;

function parseCardsLimit(rawLimit: string | null):
  | { ok: true; limit: number }
  | { ok: false; message: string } {
  if (rawLimit === null || rawLimit.trim() === "") {
    return { ok: true, limit: DEFAULT_CARDS_LIMIT };
  }

  const normalizedLimit = rawLimit.trim();
  if (!/^\d+$/.test(normalizedLimit)) {
    return { ok: false, message: "limit must be a positive integer" };
  }

  const limit = Number.parseInt(normalizedLimit, 10);
  if (!Number.isFinite(limit) || limit < 1 || limit > MAX_CARDS_LIMIT) {
    return { ok: false, message: `limit must be between 1 and ${MAX_CARDS_LIMIT}` };
  }

  return { ok: true, limit };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ wallId: string }> },
) {
  const { wallId } = await params;
  if (isQ2B6FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) { const body=await request.json().catch(()=>null) as { text?: string } | null; const card=q2B6CreateCard(wallId, body?.text?.trim() ?? ""); return card ? NextResponse.json({ok:true,cardId:card.id}) : NextResponse.json({ok:false},{status:403}); }
  await requireUser("/dashboard");

  const body = (await request.json()) as {
    boardId?: string;
    text?: string;
    externalAttachments?: unknown;
  };

  if (typeof body.boardId !== "string" || body.boardId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "boardId 값이 필요합니다." },
      { status: 400 },
    );
  }

  const normalizedBoardId = body.boardId.trim();
  const wall = await getWall(normalizedBoardId, wallId);

  if (!wall) {
    return NextResponse.json(
      { ok: false, error: "담벼락을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const text = typeof body.text === "string" && body.text.trim().length > 0 ? body.text.trim() : "첨부 파일";
  const externalAttachments = normalizeExternalAttachments(body.externalAttachments);

  try {
    const card = await createCard({
      wallId: wall.id,
      text,
      boardId: normalizedBoardId,
      externalAttachments,
    });
    revalidatePath(`/dashboard/boards/${normalizedBoardId}/grid`);
    revalidatePath(`/dashboard/boards/${normalizedBoardId}/walls/${wall.id}`);
    await logAudit({
      boardId: normalizedBoardId,
      action: AUDIT_ACTIONS.cardCreated,
      targetType: "card",
      targetId: card.id,
      meta: {
        textLen: card.text.length,
        hasAttachments: externalAttachments.length > 0,
        wallId: wall.id,
      },
    });
    void recordAuditEvent({
      action: AUDIT_ACTIONS.cardCreated,
      targetType: "card",
      targetId: card.id,
      meta: {
        boardId: normalizedBoardId,
        cardId: card.id,
      },
    });

    if (shouldBumpActivity("cardCreate")) {
      try {
        await bumpBoardAndWallActivityByWallId({ wallId: wall.id });
      } catch (bumpError) {
        console.debug("activity_bump_failed", bumpError);
      }
    }

    return NextResponse.json({ ok: true, cardId: card.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드 생성 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ wallId: string }> },
) {
  const { wallId } = await params;
  if (isQ2B6FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) {
    const entry = q2B6Walls().find(({ wall }) => wall.id === wallId);
    return entry ? NextResponse.json({ ok: true, cards: entry.cards }) : NextResponse.json({ ok: false }, { status: 404 });
  }
  await requireUser("/dashboard");

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId") ?? "";
  const cursor = decodeCardCursor(searchParams.get("cursor"));
  const limitParam = searchParams.get("limit");
  const includeHiddenParam = searchParams.get("includeHidden");

  if (!boardId.trim()) {
    return NextResponse.json(
      { ok: false, error: "boardId 값이 필요합니다." },
      { status: 400 },
    );
  }

  const wall = await getWall(boardId, wallId);

  if (!wall) {
    return NextResponse.json(
      { ok: false, error: "담벼락을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const limitResult = parseCardsLimit(limitParam);
  if (!limitResult.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_limit", message: limitResult.message } },
      { status: 400 },
    );
  }

  const includeHidden = includeHiddenParam
    ? includeHiddenParam === "true" || includeHiddenParam === "1"
    : true;

  try {
    const result = await listWallCardsPaginated({
      wallId: wall.id,
      includeHidden,
      cursor,
      limit: limitResult.limit,
      orderByPosition: true,
    });

    const filesByCard = await listFilesByCardIds(result.items.map((card) => card.id));

    const cards = result.items.map((card) => ({
      id: card.id,
      wallId: card.wall_id,
      position: card.position,
      text: card.text,
      authorName: card.author_name,
      authorType: card.author_type,
      createdAt: card.created_at,
      isHidden: card.is_hidden,
      isPinned: card.is_pinned,
      isFeatured: card.is_featured,
      cardColorToken: card.card_color_token,
      hasAttachments:
        (filesByCard[card.id]?.length ?? 0) > 0 ||
        (card.external_attachments?.length ?? 0) > 0,
      files: (filesByCard[card.id] ?? []).map((file) => ({
        id: file.id,
        filename: file.filename,
        contentType: file.content_type,
        sizeBytes: file.size_bytes,
        downloadUrl: routes.api.files.download(file.id),
      })),
      externalAttachments: card.external_attachments,
    }));

    return NextResponse.json({
      ok: true,
      items: cards,
      cards,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cards_load_failed";
    console.error("[dashboard.walls.cards] load_failed", { boardId, wallId: wall.id, message });
    return NextResponse.json(
      { ok: false, error: { code: "cards_load_failed", message } },
      { status: 500 },
    );
  }
}
