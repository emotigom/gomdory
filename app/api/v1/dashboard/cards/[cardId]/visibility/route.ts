import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { loadCardForUpload, setCardHiddenForAuthorizedBoard } from "@/lib/data/cards";
import { bumpBoardAndWallActivityByCardId, shouldBumpActivity } from "@/lib/db/activityBump";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isQ2B7FixtureAuthorized, q2B7CanOperate, q2B7UpdateVisibility, q2B7VisibilityScenario } from "@/lib/q2/browser/teacherOperationFixture";
import { isQ2B10Authorized, setQ2B10Visibility } from "@/lib/q2/browser/multiUserPollingFixture";

type VisibilityDeps = {
  requireUserFn?: (returnTo: string) => Promise<{ user: Pick<User, "id"> }>;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  loadCardForUploadFn?: typeof loadCardForUpload;
  setCardHiddenForAuthorizedBoardFn?: typeof setCardHiddenForAuthorizedBoard;
  shouldBumpActivityFn?: typeof shouldBumpActivity;
  bumpBoardAndWallActivityByCardIdFn?: typeof bumpBoardAndWallActivityByCardId;
};

function isMissingSupabaseEnvError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("missing supabase env vars");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
  deps: VisibilityDeps = {},
) {
  const { cardId } = await params;
  if (isQ2B10Authorized(request.headers.get("x-q2-browser-fixture-authorized"))) { const body = await request.json().catch(() => null) as { hidden?: boolean } | null; const result = typeof body?.hidden === "boolean" ? setQ2B10Visibility(cardId, body.hidden) : null; return result ? NextResponse.json({ ok: true, card: { id: result.card.id, wallId: result.card.wallId, position: result.card.position, isHidden: result.card.isHidden, hiddenAt: result.card.hiddenAt }, fixtureDataVersion: result.stateVersion }) : NextResponse.json({ ok: false }, { status: 404 }); }
  if (isQ2B7FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) { const body = await request.json().catch(() => null) as { hidden?: boolean } | null; if (!q2B7CanOperate(request.headers)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }); if (typeof body?.hidden !== "boolean") return NextResponse.json({ ok: false }, { status: 400 }); const scenario = q2B7VisibilityScenario(); if (scenario === "retryable-failure") return NextResponse.json({ ok: false, error: "temporary" }, { status: 503 }); if (scenario === "terminal-failure") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }); const result = q2B7UpdateVisibility(cardId, body.hidden); return result ? NextResponse.json({ ok: true, card: { id: result.card.id, wallId: result.card.wall_id, position: result.card.position, isHidden: result.card.is_hidden, hiddenAt: result.card.hidden_at }, fixtureDataVersion: scenario === "version-mismatch" ? result.stateVersion + 1 : result.stateVersion }) : NextResponse.json({ ok: false }, { status: 404 }); }
  const requireUserFn = deps.requireUserFn ?? requireUser;
  let user: Pick<User, "id">;

  try {
    ({ user } = await requireUserFn("/dashboard"));
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      throw error;
    }
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as { hidden?: boolean };

  if (typeof body.hidden !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "hidden 값이 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = (deps.createSupabaseAdminClientFn ?? createSupabaseAdminClient)();
    const cardLookup = await (deps.loadCardForUploadFn ?? loadCardForUpload)({ supabase, cardId });

    if (!cardLookup) {
      return NextResponse.json({ ok: false, error: "카드를 찾을 수 없습니다." }, { status: 404 });
    }

    const isOwner = cardLookup.boardOwnerId === user.id;
    if (!isOwner) {
      const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: cardLookup.boardId });
      if (roleError) {
        return NextResponse.json({ ok: false, error: roleError.message }, { status: 400 });
      }

      const role = normalizeBoardRole(roleResult);
      if (!canEditBoard(role)) {
        return NextResponse.json({ ok: false, error: "카드를 숨김 처리할 권한이 없습니다." }, { status: 403 });
      }
    }

    const card = await (deps.setCardHiddenForAuthorizedBoardFn ?? setCardHiddenForAuthorizedBoard)({
      supabase,
      cardId,
      hidden: body.hidden,
    });

    if ((deps.shouldBumpActivityFn ?? shouldBumpActivity)("cardUpdateStatus")) {
      try {
        await (deps.bumpBoardAndWallActivityByCardIdFn ?? bumpBoardAndWallActivityByCardId)({ cardId });
      } catch (bumpError) {
        console.debug("activity_bump_failed", bumpError);
      }
    }

    return NextResponse.json({
      ok: true,
      card: {
        id: card.id,
        wallId: card.wall_id,
        position: card.position,
        isHidden: card.is_hidden,
        hiddenAt: card.hidden_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "업데이트 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
