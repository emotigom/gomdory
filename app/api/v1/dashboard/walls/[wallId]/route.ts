import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/requireUser";
import { deleteWall, getWall, updateWall } from "@/lib/data/walls";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ wallId: string }> },
) {
  const { wallId } = await params;
  const { user } = await requireUser("/dashboard");
  const body = (await request.json().catch(() => null)) as { boardId?: string; title?: string } | null;
  const boardId = typeof body?.boardId === "string" ? body.boardId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!boardId) return NextResponse.json({ ok: false, error: "보드 정보를 확인해주세요." }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: "섹션 이름을 입력해주세요." }, { status: 400 });

  try {
    await updateWall({ boardId, wallId, ownerId: user.id, title, description: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "섹션 이름을 변경하지 못했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  revalidatePath(`/dashboard/boards/${boardId}`);
  revalidatePath(`/dashboard/boards/${boardId}/board`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ wallId: string }> },
) {
  const { wallId } = await params;
  const { user } = await requireUser("/dashboard");

  const body = (await request.json()) as { boardId?: string };

  if (typeof body.boardId !== "string" || body.boardId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "boardId 값이 필요합니다." },
      { status: 400 },
    );
  }

  const normalizedBoardId = body.boardId.trim();
  const wall = await getWall(normalizedBoardId, wallId);
  if (!wall) return NextResponse.json({ ok: false, error: "섹션 정보를 확인해주세요." }, { status: 404 });

  const supabase = createSupabaseServerClient();
  const { count, error: countError } = await supabase.from("cards").select("id", { count: "exact", head: true }).eq("wall_id", wallId);
  if (countError) return NextResponse.json({ ok: false, error: "섹션 정보를 확인하지 못했습니다." }, { status: 400 });
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: false, error: "카드가 있는 섹션은 먼저 카드를 이동하거나 삭제해야 합니다." }, { status: 400 });
  }

  try {
    await deleteWall({ boardId: normalizedBoardId, wallId, ownerId: user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "담벼락 삭제 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/grid`);

  return NextResponse.json({ ok: true });
}
