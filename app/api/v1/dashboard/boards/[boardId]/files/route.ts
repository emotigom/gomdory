import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { listBoardFiles } from "@/lib/data/boardFiles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    await requireUser(`/dashboard/boards/${boardId}/files`);
    const files = await listBoardFiles(boardId);
    return NextResponse.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
