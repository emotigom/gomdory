import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { createCard } from "@/lib/data/cards";
import { touchBoardFile } from "@/lib/data/boardFiles";
import { attachBoardFileToCard } from "@/lib/data/cardFiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string; fileId: string }> },
) {
  try {
    const { boardId, fileId } = await params;
    const { user } = await requireUser(`/dashboard/boards/${boardId}/files`);
    const supabase = createSupabaseServerClient();
    const payload = (await req.json().catch(() => null)) as { wallId?: string | null } | null;

    const { data: fileRow, error: fileError } = await supabase
      .from("board_files")
      .select("id, r2_key, filename, mime, bytes, owner_id")
      .eq("id", fileId)
      .eq("owner_id", user.id)
      .single();

    if (fileError) {
      throw new Error(fileError.message);
    }

    if (!fileRow) {
      throw new Error("파일 정보를 찾지 못했습니다.");
    }

    let wallQuery = supabase
      .from("walls")
      .select("id")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (payload?.wallId) {
      wallQuery = wallQuery.eq("id", payload.wallId);
    }

    const { data: wallRow, error: wallError } = await wallQuery.single();

    if (wallError || !wallRow) {
      throw new Error("보드에 담벼락이 없습니다.");
    }

    const text = `📎 ${fileRow.filename}`;
    const card = await createCard({
      wallId: wallRow.id,
      text,
      boardId,
    });
    await attachBoardFileToCard({ cardId: card.id, boardFileId: fileRow.id });
    await touchBoardFile({ fileId: fileRow.id, ownerId: user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
