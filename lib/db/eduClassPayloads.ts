import "server-only";

import { toSnakeKeys } from "@/lib/standards/fields";

type EduClassInsertPayload = {
  board_id: string;
  share_code: string;
};

type EduJoinCodeInsertPayload = {
  code: string;
  board_id: string;
  is_active: boolean;
};

export function buildEduClassInsertPayload(boardId: string, shareCode: string): EduClassInsertPayload {
  return toSnakeKeys({ boardId, shareCode }) as EduClassInsertPayload;
}

export function buildEduJoinCodeInsertPayload(code: string, boardId: string): EduJoinCodeInsertPayload {
  return toSnakeKeys({ code, boardId, isActive: true }) as EduJoinCodeInsertPayload;
}
