import { NextRequest, NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createCard } from "@/lib/data/cards";
import { touchBoardFile } from "@/lib/data/boardFiles";
import { attachBoardFileToCard } from "@/lib/data/cardFiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseClientFn?: typeof createSupabaseServerClient;
  createCardFn?: typeof createCard;
  touchBoardFileFn?: typeof touchBoardFile;
};

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
  deps?: Dependencies,
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const supabase = deps?.createSupabaseClientFn?.() ?? createSupabaseServerClient();
  const insertCard = deps?.createCardFn ?? createCard;
  const touchFile = deps?.touchBoardFileFn ?? touchBoardFile;

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { fileId?: string | null; wallId?: string | null } | null;
  if (!body?.fileId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const { boardId } = await params;

  const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const role = normalizeBoardRole(roleResult);
  if (roleError || !role) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const { data: fileRow, error: fileError } = await supabase
      .from("board_files")
      .select("id, r2_key, filename, mime, bytes, owner_id")
      .eq("id", body.fileId)
      .eq("owner_id", userId ?? "")
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

    if (body.wallId) {
      wallQuery = wallQuery.eq("id", body.wallId);
    }

    const { data: wallRow, error: wallError } = await wallQuery.single();

    if (wallError || !wallRow) {
      throw new Error("보드에 담벼락이 없습니다.");
    }

    const text = `📎 ${fileRow.filename}`;
    const card = await insertCard({
      wallId: wallRow.id,
      text,
      boardId,
    });
    await attachBoardFileToCard({ cardId: card.id, boardFileId: fileRow.id });
    await touchFile({ fileId: fileRow.id, ownerId: userId ?? "" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일을 삽입하지 못했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
