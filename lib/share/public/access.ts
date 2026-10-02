import "server-only";

import type { ShareBoard, ShareWall } from "@/lib/data/share";
import { getBoardByShareCode, listWallsForShare, normalizeShareCode } from "@/lib/data/share";

// Public-entry/server-only boundary:
// - keep generic share domain helpers in lib/share/*
// - keep board/wall resolution and write guards for app/s/** and app/api/v1/share/** here

export type PublicShareBoardResolution = {
  normalizedCode: string;
  board: ShareBoard | null;
};

export type PublicShareWallResolution = PublicShareBoardResolution & {
  wall: ShareWall | null;
};

export async function resolvePublicShareBoard(code: string): Promise<PublicShareBoardResolution> {
  const normalizedCode = normalizeShareCode(code);
  const board = await getBoardByShareCode(normalizedCode);
  return { normalizedCode, board };
}

export async function resolvePublicShareWall(params: {
  code: string;
  wallId: string;
}): Promise<PublicShareWallResolution> {
  const { normalizedCode, board } = await resolvePublicShareBoard(params.code);

  if (!board) {
    return { normalizedCode, board: null, wall: null };
  }

  const walls = await listWallsForShare(board.id);
  const wall = walls.find((candidate) => candidate.id === params.wallId) ?? null;

  return { normalizedCode, board, wall };
}

export function getPublicShareWriteGuard(board: ShareBoard):
  | { ok: true }
  | { ok: false; code: string; message: string; status: number } {
  if (board.class_state === "ended") {
    return { ok: false, code: "CLASS_ENDED", message: "class_ended", status: 403 };
  }

  if (!board.share_write_enabled) {
    return {
      ok: false,
      code: "WRITING_DISABLED",
      message: "지금은 글쓰기가 잠겨있습니다.",
      status: 403,
    };
  }

  return { ok: true };
}

export function getPublicWallWriteGuard(wall: ShareWall):
  | { ok: true }
  | { ok: false; code: string; message: string; status: number } {
  if (!wall.student_write_enabled) {
    return {
      ok: false,
      code: "WRITING_DISABLED",
      message: "이 섹션은 지금 제출이 잠겨 있어요.",
      status: 403,
    };
  }

  return { ok: true };
}
