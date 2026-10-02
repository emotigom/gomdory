import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import {
  bumpBoardAndWallActivityByCardId,
  shouldBumpActivity,
} from "@/lib/db/activityBump";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCardColorToken } from "@/lib/types/cards";

type CardColorLookup = {
  id: string;
  owner_id?: string | null;
  walls?: {
    board_id?: string | null;
    boards?: { owner_id?: string | null } | null;
  } | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const { user } = await requireUser(`/dashboard`);

  const body = (await request.json()) as { token?: string | null };

  if (
    body.token !== null &&
    body.token !== undefined &&
    !isCardColorToken(body.token)
  ) {
    return NextResponse.json(
      { ok: false, error: "지원하지 않는 색상입니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: card, error: lookupError } = await supabase
      .from("cards")
      .select("id, owner_id, walls!inner(board_id, boards!inner(owner_id))")
      .eq("id", cardId)
      .is("deleted_at", null)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!card) {
      throw new Error("카드를 찾을 수 없습니다.");
    }

    const lookup = card as CardColorLookup;
    const cardOwnerId = lookup.owner_id ?? null;
    const boardOwnerId = lookup.walls?.boards?.owner_id ?? null;
    const canUpdate = cardOwnerId === user.id || boardOwnerId === user.id;

    if (!canUpdate) {
      throw new Error("카드를 업데이트할 권한이 없습니다.");
    }

    const { error: updateError, data: updated } = await supabase
      .from("cards")
      .update(toSnakeKeys({
        cardColorToken: body.token ?? null,
        updatedAt: new Date().toISOString(),
      }))
      .eq("id", cardId)
      .select("id");

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updated?.length) {
      throw new Error("카드를 업데이트하지 못했습니다.");
    }

    if (shouldBumpActivity("cardUpdateColor")) {
      try {
        await bumpBoardAndWallActivityByCardId({ cardId });
      } catch (bumpError) {
        console.debug("activity_bump_failed", bumpError);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "업데이트 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
