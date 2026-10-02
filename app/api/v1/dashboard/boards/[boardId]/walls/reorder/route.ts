import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const { user } = await requireUser(`/dashboard/boards/${boardId}`);

  let payload: { wallIds?: unknown } | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const wallIds = Array.isArray(payload?.wallIds) ? payload.wallIds : null;

  if (!wallIds || wallIds.length === 0 || wallIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { ok: false, error: "담벼락 순서를 확인해주세요." },
      { status: 400 },
    );
  }

  const uniqueIds = new Set(wallIds);
  if (uniqueIds.size !== wallIds.length) {
    return NextResponse.json(
      { ok: false, error: "담벼락 순서를 확인해주세요." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (boardError) {
    return NextResponse.json({ ok: false, error: boardError.message }, { status: 400 });
  }

  if (!board) {
    return NextResponse.json({ ok: false, error: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id")
    .eq("board_id", board.id)
    .eq("owner_id", user.id)
    .in("id", wallIds);

  if (wallsError) {
    return NextResponse.json({ ok: false, error: wallsError.message }, { status: 400 });
  }

  const existingIds = new Set((walls ?? []).map((wall) => wall.id));
  if (existingIds.size !== wallIds.length || wallIds.some((id) => !existingIds.has(id))) {
    return NextResponse.json(
      { ok: false, error: "담벼락 순서를 확인해주세요." },
      { status: 400 },
    );
  }

  const updates = wallIds.map((id, index) => ({
    id,
    position: index + 1,
  }));

  for (const update of updates) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("walls")
      .update({ position: update.position })
      .eq("id", update.id)
      .eq("board_id", board.id)
      .eq("owner_id", user.id)
      .select("id");

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    if (!updatedRows?.length) {
      return NextResponse.json(
        { ok: false, error: "?대꼈???쒖꽌瑜??낅뜲?댄듃?섏? 紐삵뻽?듬땲??" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
