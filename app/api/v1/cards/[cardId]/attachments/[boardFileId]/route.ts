import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { detachCardFileAssociation, DetachCardFileAssociationError } from "@/lib/db/cardFilesDetach";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bumpBoardAndWallActivityByCardId, shouldBumpActivity } from "@/lib/db/activityBump";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseClientFn?: typeof createSupabaseServerClient;
};

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string; boardFileId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const supabase = deps?.createSupabaseClientFn?.() ?? createSupabaseServerClient();

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { cardId, boardFileId } = await params;

  const { data: cardRow, error: cardError } = await supabase
    .from("cards")
    .select("id, wallId:wall_id, walls!inner(boardId:board_id)")
    .eq("id", cardId)
    .is("deleted_at", null)
    .maybeSingle();

  if (cardError) {
    return NextResponse.json({ ok: false, error: "card_lookup_failed" }, { status: 400 });
  }

  const card = cardRow as { id: string; wallId: string; walls: { boardId: string } | null } | null;
  if (!card?.walls?.boardId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: card.walls.boardId });
  const role = normalizeBoardRole(roleResult);
  if (roleError || (role !== "owner" && role !== "editor")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: boardFile, error: boardFileError } = await supabase
    .from("board_files")
    .select("id, owner_id")
    .eq("id", boardFileId)
    .eq("owner_id", userId ?? "")
    .maybeSingle();

  if (boardFileError) {
    return NextResponse.json({ ok: false, error: "file_lookup_failed" }, { status: 400 });
  }

  if (!boardFile) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  try {
    await detachCardFileAssociation({
      supabaseAdmin: supabase,
      cardId,
      boardFileId,
    });

    if (shouldBumpActivity("attachmentUnlink")) {
      try {
        await bumpBoardAndWallActivityByCardId({ cardId });
      } catch (bumpError) {
        console.debug("activity_bump_failed", bumpError);
      }
    }
  } catch (error) {
    if (error instanceof DetachCardFileAssociationError) {
      return NextResponse.json({ ok: false, error: "detach_failed" }, { status: 400 });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
