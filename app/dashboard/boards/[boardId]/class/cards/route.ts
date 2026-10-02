import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { getBoard } from "@/lib/data/boards.server";
import { listCards } from "@/lib/data/cards";
import { listFilesByCardIds } from "@/lib/data/files";

export async function GET(request: NextRequest) {
  const pathnameSegments = request.nextUrl.pathname.split("/");
  const boardId = pathnameSegments[3];
  const url = request.nextUrl;

  if (!boardId) {
    return NextResponse.json({ error: "boardId is required" }, { status: 400 });
  }
  const wallId = url.searchParams.get("wallId");

  if (!wallId) {
    return NextResponse.json({ error: "wallId is required" }, { status: 400 });
  }

  const { user } = await requireUser(`/dashboard/boards/${boardId}/class`);
  const { board } = await getBoard(boardId, { userId: user.id });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  try {
    const cards = await listCards(wallId);
    const filesByCard = await listFilesByCardIds(cards.map((card) => card.id));

    return NextResponse.json({
      cards,
      filesByCard,
      boardId,
      wallId,
      userId: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
