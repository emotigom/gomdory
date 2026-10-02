import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { getTeacherDefaults } from "@/lib/data/profile";
import { createWall } from "@/lib/data/walls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isQ2B6FixtureAuthorized, q2B6CreateWall, q2B6Walls } from "@/lib/q2/browser/teacherPreparationFixture";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  if (isQ2B6FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) return NextResponse.json({ ok: true, walls: q2B6Walls().map(({ wall }) => wall) });
  await requireUser(`/dashboard/boards/${boardId}/board`);

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return NextResponse.json({ ok: false, error: "보드를 확인하지 못했습니다." }, { status: 404 });
  }

  if (boardRole === "viewer") {
    return NextResponse.json({ ok: false, error: "이 보드에 접근할 수 없습니다." }, { status: 403 });
  }

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id, title, position, created_at")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (wallsError) {
    return NextResponse.json({ ok: false, error: wallsError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, walls: walls ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  if (isQ2B6FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) {
    const body = await request.json().catch(() => null) as { title?: string } | null;
    const title = body?.title?.trim() ?? "";
    return title ? NextResponse.json({ ok: true, wallId: q2B6CreateWall(title).id }) : NextResponse.json({ ok: false }, { status: 400 });
  }
  const { user } = await requireUser(`/dashboard/boards/${boardId}/board`);

  let payload: { title?: string; description?: string | null } | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return NextResponse.json({ ok: false, error: "섹션 이름을 입력해주세요." }, { status: 400 });
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

  const description =
    typeof payload?.description === "string" && payload.description.trim().length > 0
      ? payload.description.trim()
      : null;
  const teacherDefaults = await getTeacherDefaults(user.id);

  try {
    const wall = await createWall({
      boardId,
      title,
      description,
      widthPx: teacherDefaults.defaultWallWidthPx,
    });
    return NextResponse.json({ ok: true, wallId: wall.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "담벼락을 생성하지 못했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
