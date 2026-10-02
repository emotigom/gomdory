import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { createBoardUploadPlan } from "@/lib/data/boardFiles";
import {
  assertStorageUploadAllowed,
  StorageUploadQuotaExceededError,
} from "@/lib/storage/uploadQuota.server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { user } = await requireUser(`/dashboard/boards/${boardId}/files`);
    const body = (await req.json()) as {
      filename?: string;
      bytes?: number;
      mime?: string | null;
      hashSha256?: string;
      width?: number | null;
      height?: number | null;
      originalBytes?: number | null;
      optimizedBytes?: number | null;
      variant?: string | null;
    };

    if (!body?.filename || !Number.isFinite(body.bytes) || !body.hashSha256) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    await assertStorageUploadAllowed(user.id, Number(body.bytes));

    const plan = await createBoardUploadPlan({
      boardId,
      filename: body.filename,
      bytes: Number(body.bytes),
      mime: body.mime ?? null,
      hashSha256: body.hashSha256,
      width: body.width ?? null,
      height: body.height ?? null,
      originalBytes: body.originalBytes ?? null,
      optimizedBytes: body.optimizedBytes ?? null,
      variant: (body.variant as "optimized" | "thumb" | "original" | null) ?? undefined,
      ownerId: user.id,
    });

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof StorageUploadQuotaExceededError) {
      return NextResponse.json(
        { error: error.code, ...error.snapshot },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
