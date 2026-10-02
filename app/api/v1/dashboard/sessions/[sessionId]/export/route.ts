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
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const { user } = await requireUser(`/dashboard/sessions/${sessionId}`);

  const supabase = createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, board_id, owner_id, started_at, ended_at")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (sessionError) {
    return new Response(sessionError.message, { status: 400 });
  }

  if (!session) {
    return new Response("세션을 찾을 수 없습니다.", { status: 404 });
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id")
    .eq("board_id", session.board_id)
    .order("position", { ascending: true });

  if (wallsError) {
    return new Response(wallsError.message, { status: 400 });
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);
  const endedAt = session.ended_at ?? new Date().toISOString();

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, wall_id, author_type, author_name, text, is_hidden, is_pinned, is_featured, created_at",
    )
    .in("wall_id", wallIds.length > 0 ? wallIds : [""])
    .gte("created_at", session.started_at)
    .lte("created_at", endedAt)
    .order("created_at", { ascending: true });

  if (cardsError) {
    return new Response(cardsError.message, { status: 400 });
  }

  const header = [
    "session_id",
    "board_id",
    "wall_id",
    "card_id",
    "author_type",
    "author_name",
    "text",
    "is_hidden",
    "is_pinned",
    "is_featured",
    "created_at",
  ];

  const rows = (cards ?? []).map((card) => [
    session.id,
    session.board_id,
    card.wall_id,
    card.id,
    card.author_type ?? "",
    card.author_name ?? "",
    card.text ?? "",
    String(card.is_hidden),
    String(card.is_pinned),
    String(card.is_featured),
    card.created_at,
  ]);

  const csvLines = [header, ...rows]
    .map((line) => line.map((value) => escapeCsv(value)).join(","))
    .join("\n");

  const csvWithBom = `\ufeff${csvLines}`;

  return new Response(csvWithBom, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="session-${sessionId}.csv"`,
    },
  });
}
