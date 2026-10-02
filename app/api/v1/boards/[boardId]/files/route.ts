import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { createCard } from "@/lib/data/cards";
import { touchBoardFile } from "@/lib/data/boardFiles";
import { attachBoardFileToCard } from "@/lib/data/cardFiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InsertPayload = {
  fileId?: string;
  mode?: "attach" | "embed";
  title?: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const { boardId } = await params;
    const { user } = await requireUser(`/dashboard/boards/${boardId}/files`);
    const payload = (await request.json().catch(() => null)) as InsertPayload | null;

    if (!payload?.fileId) {
      return NextResponse.json({ ok: false, error: "fileId_required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: fileRow, error: fileError } = await supabase
      .from("board_files")
      .select("id, r2_key, filename, mime, bytes, owner_id")
      .eq("id", payload.fileId)
      .eq("owner_id", user.id)
      .single();

    if (fileError) {
      throw new Error(fileError.message);
    }

    if (!fileRow) {
      throw new Error("파일 정보를 찾지 못했습니다.");
    }

    const { data: wallRow, error: wallError } = await supabase
      .from("walls")
      .select("id")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (wallError || !wallRow) {
      throw new Error("보드에 담벼락이 없습니다.");
    }

    const text = payload.title?.trim() || `📎 ${fileRow.filename}`;
    const card = await createCard({
      wallId: wallRow.id,
      text,
      boardId,
    });
    await attachBoardFileToCard({ cardId: card.id, boardFileId: fileRow.id });
    await touchBoardFile({ fileId: fileRow.id, ownerId: user.id });

    return NextResponse.json({ ok: true, mode: payload.mode ?? "attach" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
