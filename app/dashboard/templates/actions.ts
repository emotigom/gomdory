"use server";

import { revalidatePath } from "next/cache";

import { normalizeBoardSummary, type DashboardBoardSummary } from "@/lib/data/boards";
import { createBoard } from "@/lib/data/boards.server";
import { createCard } from "@/lib/data/cards";
import { createWall } from "@/lib/data/walls";

import { templates } from "./_data/templates";
import type { TemplateId } from "./_data/templateTypes";

export type CreateBoardFromTemplateResult = {
  success: boolean;
  board?: DashboardBoardSummary;
  error?: string;
};

type TemplateCreationDeps = {
  createBoardFn: typeof createBoard;
  createWallFn: typeof createWall;
  createCardFn: typeof createCard;
  revalidatePathFn: typeof revalidatePath;
};

const defaultDeps: TemplateCreationDeps = {
  createBoardFn: createBoard,
  createWallFn: createWall,
  createCardFn: createCard,
  revalidatePathFn: revalidatePath,
};

function findTemplate(templateId: TemplateId) {
  return templates.find((template) => template.id === templateId) ?? null;
}

export async function createBoardFromTemplate(
  input: { templateId: TemplateId; classId?: string | null },
  deps: TemplateCreationDeps = defaultDeps,
): Promise<CreateBoardFromTemplateResult> {
  const template = findTemplate(input.templateId);

  if (!template) {
    return { success: false, error: "템플릿을 찾을 수 없습니다." };
  }

  try {
    const createdBoard = await deps.createBoardFn({
      title: template.payload.board.title,
      description: template.payload.board.description ?? null,
      classId: input.classId ?? null,
    });

    const summary = normalizeBoardSummary(createdBoard) ?? undefined;

    const columns = template.payload.board.initialColumns?.length
      ? template.payload.board.initialColumns
      : ["생각 모으기"];

    const columnMap = new Map<string, string>();

    for (const columnTitle of columns) {
      const wall = await deps.createWallFn({
        boardId: createdBoard.id,
        title: columnTitle,
        description: null,
      });
      columnMap.set(columnTitle.toLowerCase(), wall.id);
    }

    const defaultWallId = columnMap.values().next().value as string | undefined;

    if (template.payload.starterCards?.length) {
      for (const card of template.payload.starterCards) {
        const lookupKey = card.column?.toLowerCase().trim();
        const wallId = lookupKey ? columnMap.get(lookupKey) ?? defaultWallId : defaultWallId;
        if (!wallId) continue;

        await deps.createCardFn({
          wallId,
          text: card.text,
          boardId: createdBoard.id,
        });
      }
    }

    deps.revalidatePathFn("/dashboard");

    return { success: true, board: summary };
  } catch (error) {
    console.error("createBoardFromTemplate failed", error);
    const message =
      error instanceof Error ? error.message : "템플릿으로 보드를 생성하지 못했습니다.";
    return { success: false, error: message };
  }
}
