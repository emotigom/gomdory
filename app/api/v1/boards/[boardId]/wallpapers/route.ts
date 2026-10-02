import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { listBoardWallpapers } from "@/lib/boards/wallpaper.server";

const UNKNOWN_ERROR = ["unknown", "error"].join("_");

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const { boardId } = await params;
    await requireUser(`/dashboard/boards/${boardId}`);

    const { wallpapers, truncated } = await listBoardWallpapers(100);

    return NextResponse.json({ ok: true, wallpapers, truncated });
  } catch (error) {
    const message = error instanceof Error ? error.message : UNKNOWN_ERROR;
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
