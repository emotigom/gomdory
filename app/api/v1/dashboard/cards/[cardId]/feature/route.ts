import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { setCardFeatured } from "@/lib/data/cards";
import { bumpBoardAndWallActivityByCardId, shouldBumpActivity } from "@/lib/db/activityBump";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const { user } = await requireUser(`/dashboard`);

  const body = (await request.json()) as { featured?: boolean };

  if (typeof body.featured !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "featured 값이 필요합니다." },
      { status: 400 },
    );
  }

  try {
    await setCardFeatured({ cardId, ownerId: user.id, featured: body.featured });

    if (shouldBumpActivity("cardUpdateStatus")) {
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
