import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeCsv(value: string | null): string {
  const safeValue = value ?? "";
  if (/[,"\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  await requireUser(`/dashboard/boards/${boardId}`);

  const supabase = createSupabaseServerClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, title, owner_id")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    return NextResponse.json({ ok: false, error: boardError.message }, { status: 400 });
  }

  if (!board) {
    return NextResponse.json({ ok: false, error: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id, title")
    .eq("board_id", board.id)
    .order("position", { ascending: true });

  if (wallsError) {
    return NextResponse.json({ ok: false, error: wallsError.message }, { status: 400 });
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);
  const wallTitleMap = new Map<string, string>();
  (walls ?? []).forEach((wall) => {
    wallTitleMap.set(wall.id, wall.title);
  });

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, is_hidden, is_pinned, pinned_at, created_at",
    )
    .in("wall_id", wallIds.length > 0 ? wallIds : [""])
    .order("created_at", { ascending: true });

  if (cardsError) {
    return NextResponse.json({ ok: false, error: cardsError.message }, { status: 400 });
  }

  const header = [
    "board_id",
    "board_title",
    "wall_id",
    "wall_title",
    "card_id",
    "author_type",
    "author_name",
    "text",
    "is_hidden",
    "is_pinned",
    "pinned_at",
    "created_at",
  ];

  const rows = (cards ?? []).map((card) => [
    board.id,
    board.title,
    card.wall_id,
    wallTitleMap.get(card.wall_id) ?? "",
    card.id,
    card.author_type,
    card.author_name ?? "",
    card.text,
    String(card.is_hidden),
    String(card.is_pinned),
    card.pinned_at ?? "",
    card.created_at,
  ]);

  const csvLines = [header, ...rows]
    .map((line) => line.map((value) => escapeCsv(value)).join(","))
    .join("\n");

  const csvWithBom = `\ufeff${csvLines}`;

  return new Response(csvWithBom, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="board-${boardId}.csv"`,
    },
  });
}
