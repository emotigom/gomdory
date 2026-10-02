import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { createCard, listWallCardsForEduLink, updateCardExternalAttachments, updateCardText } from "@/lib/data/cards";
import { createWall, listWalls } from "@/lib/data/walls";
import { createPracticeSnapshotAttachment } from "@/lib/labs/practiceSnapshot";
import { normalizeExternalAttachments } from "@/lib/types/attachments";

type Body = {
  boardId?: string;
  title?: string;
  html?: string;
  css?: string;
  js?: string;
  action?: "save" | "submit";
  studentName?: string;
};

async function resolveTargetWall(boardId: string) {
  const walls = await listWalls(boardId);
  const byEdu = walls.find((wall) => wall.title.trim().toLowerCase() === "edu");
  if (byEdu) return byEdu;
  const byPractice = walls.find((wall) => wall.title.trim() === "실습");
  if (byPractice) return byPractice;
  return createWall({ boardId, title: "실습" });
}

export async function POST(request: Request) {
  await requireUser("/dashboard");

  const body = (await request.json().catch(() => ({}))) as Body;
  const boardId = typeof body.boardId === "string" ? body.boardId.trim() : "";
  if (!boardId) {
    return NextResponse.json({ ok: false, message: "boardId가 필요합니다." }, { status: 400 });
  }

  const action = body.action === "submit" ? "submit" : "save";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "실습 제출";
  const snapshot = createPracticeSnapshotAttachment({
    title,
    html: body.html ?? "",
    css: body.css ?? "",
    js: body.js ?? "",
  });

  const wall = await resolveTargetWall(boardId);
  const authorName = action === "submit" ? "익명" : "선생님";
  const cardTitle =
    action === "submit"
      ? `제출 - ${typeof body.studentName === "string" && body.studentName.trim() ? body.studentName.trim() : "익명"}`
      : "실습 - 저장본";

  if (action === "save") {
    const existing = (await listWallCardsForEduLink(wall.id)).find((card) => card.text.trim() === cardTitle);
    if (existing) {
      await updateCardText({ cardId: existing.id, text: cardTitle, authorName, authorType: "teacher" });
      await updateCardExternalAttachments({
        cardId: existing.id,
        externalAttachments: normalizeExternalAttachments([snapshot]),
        authorName,
        authorType: "teacher",
      });
      return NextResponse.json({ ok: true, cardId: existing.id, wallId: wall.id, updated: true });
    }
  }

  const card = await createCard({
    boardId,
    wallId: wall.id,
    text: cardTitle,
    authorName,
    authorType: "teacher",
    externalAttachments: normalizeExternalAttachments([snapshot]),
  });

  return NextResponse.json({ ok: true, cardId: card.id, wallId: wall.id, updated: false });
}
