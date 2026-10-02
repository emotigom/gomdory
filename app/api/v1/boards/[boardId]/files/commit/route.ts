import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/data/audit";
import { commitBoardFile } from "@/lib/data/boardFiles";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    await requireUser(`/dashboard/boards/${boardId}/files`);
    const body = (await req.json()) as {
      r2Key?: string;
      filename?: string;
      bytes?: number;
      mime?: string | null;
      width?: number | null;
      height?: number | null;
      hashSha256?: string | null;
      variant?: string | null;
      originalBytes?: number | null;
      optimizedBytes?: number | null;
      bytesSaved?: number | null;
    };

    if (!body?.r2Key || !body.filename || !Number.isFinite(body.bytes)) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const saved = await commitBoardFile({
      boardId,
      r2Key: body.r2Key,
      filename: body.filename,
      bytes: Number(body.bytes),
      mime: body.mime ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      hashSha256: body.hashSha256 ?? null,
      variant: (body.variant as "optimized" | "thumb" | "original" | null) ?? undefined,
      originalBytes: body.originalBytes ?? null,
      optimizedBytes: body.optimizedBytes ?? null,
      bytesSaved: body.bytesSaved ?? null,
    });

    void logAudit({
      boardId,
      action: "file.uploaded",
      targetType: "file",
      targetId: saved.id,
      meta: {
        filename: saved.filename,
        bytes: saved.bytes,
        mime: saved.mime ?? null,
      },
    });

    return NextResponse.json({ file: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
