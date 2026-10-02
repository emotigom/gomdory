import "server-only";

import { createBoard } from "@/lib/data/boards.server";
import { createCard } from "@/lib/data/cards";
import { upsertBoardShareSettings } from "@/lib/data/boardShareSettings";
import { parseStudentDefaultView } from "@/lib/data/boardShareSettingsShared";
import { createWall } from "@/lib/data/walls";
import type { BoardViewType } from "@/lib/data/boards";
import type { TemplatePayload } from "@/lib/templates/sanitize";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";

type TemplatePayloadInput = SanitizedTemplatePayload | TemplatePayload;

const BOARD_VIEW_TYPES: BoardViewType[] = ["grid", "wall", "mindmap", "gen"];

function isTemplatePayloadV1(payload: TemplatePayloadInput): payload is TemplatePayload {
  return (payload as TemplatePayload).kind === "board_template";
}

export async function createBoardFromTemplatePayload(payload: TemplatePayloadInput): Promise<string> {
  if (isTemplatePayloadV1(payload)) {
    const title = payload.title || "새 보드";
    const description = payload.description ?? null;
    const layoutType = payload.board.layoutType ?? undefined;
    const boardViewType = layoutType && BOARD_VIEW_TYPES.includes(layoutType as BoardViewType)
      ? (layoutType as BoardViewType)
      : undefined;
    const board = await createBoard({
      title,
      description,
      boardViewType,
    });

    const columnCount = Math.max(1, Math.min(payload.board.columns ?? 1, 12));
    const wallIds: string[] = [];
    for (let index = 0; index < columnCount; index += 1) {
      const created = await createWall({
        boardId: board.id,
        title: `컬럼 ${index + 1}`,
        description: null,
      });
      wallIds.push(created.id);
    }

    for (const card of payload.board.cards) {
      const wallIndex = card.columnIndex ?? 0;
      const wallId = wallIds[Math.min(Math.max(wallIndex, 0), wallIds.length - 1)];
      if (!wallId) continue;

      const text = card.text?.trim();
      if (text) {
        await createCard({
          wallId,
          text,
          boardId: board.id,
        });
        continue;
      }

      if (card.attachments && card.attachments.length > 0) {
        await createCard({
          wallId,
          text: "첨부 자료",
          boardId: board.id,
        });
      }
    }

    return board.id;
  }

  const title = payload.board.title || "새 보드";
  const description = payload.board.description ?? null;

  const board = await createBoard({
    title,
    description,
    boardViewType: payload.board.boardViewType ?? undefined,
  });

  if (payload.board.viewDefaults?.studentDefaultView) {
    const studentDefaultView = parseStudentDefaultView(payload.board.viewDefaults.studentDefaultView);
    if (studentDefaultView) {
      await upsertBoardShareSettings(board.id, {
        studentDefaultView,
      });
    }
  }

  const wallInputs = payload.walls.length
    ? payload.walls
    : [{ title: "생각 모으기", description: null, position: 1 }];

  const wallIds: string[] = [];
  for (const wall of wallInputs) {
    const created = await createWall({
      boardId: board.id,
      title: wall.title,
      description: wall.description ?? null,
    });
    wallIds.push(created.id);
  }

  for (const card of payload.cards) {
    const wallId = wallIds[card.wallIndex];
    if (!wallId) continue;

    if (card.kind === "text") {
      await createCard({
        wallId,
        text: card.text,
        boardId: board.id,
      });
      continue;
    }

    const attachment = card.attachment;
    const downloadPath = attachment.downloadPath ?? null;
    await createCard({
      wallId,
      text: attachment.filename || "첨부 자료",
      boardId: board.id,
      externalAttachments: downloadPath
        ? [
            {
              filename: attachment.filename,
              downloadPath,
              byteSize: attachment.byteSize ?? null,
              contentType: attachment.contentType ?? null,
              kind: "link",
            },
          ]
        : null,
    });
  }

  return board.id;
}
