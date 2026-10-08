import type { StudentBoardModel } from "@/lib/student/boardModel";

export type StudentRuntimeClassState = "idle" | "live" | "ended";

export type StudentRuntimeAuthority = {
  shareWriteEnabled: boolean;
  classState: StudentRuntimeClassState;
};

export type StudentBoardSyncData = StudentRuntimeAuthority & {
  boardId: string;
  shareCode: string;
  model: StudentBoardModel;
  syncedAt: string;
  stateVersion?: number;
};

export type StudentBoardSyncResponse = StudentBoardSyncData & {
  ok: true;
  requestId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStudentBoardModelShape(value: unknown): value is StudentBoardModel {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.cards) || !Array.isArray(value.pinnedCards)) return false;
  if (!Array.isArray(value.columns)) return false;

  return value.columns.every((column) => (
    isRecord(column) &&
    typeof column.key === "string" &&
    Boolean(column.key) &&
    typeof column.title === "string" &&
    Array.isArray(column.cards) &&
    (column.studentWriteEnabled === undefined || typeof column.studentWriteEnabled === "boolean") &&
    (column.uiColorToken === undefined ||
      column.uiColorToken === null ||
      typeof column.uiColorToken === "string")
  ));
}

export function isStudentRuntimeClassState(
  value: unknown,
): value is StudentRuntimeClassState {
  return value === "idle" || value === "live" || value === "ended";
}

export function isStudentRuntimeAuthority(
  value: unknown,
): value is Record<string, unknown> & StudentRuntimeAuthority {
  if (!isRecord(value)) return false;
  return (
    typeof value.shareWriteEnabled === "boolean" &&
    isStudentRuntimeClassState(value.classState)
  );
}

export function parseStudentBoardSyncResponse(
  value: unknown,
): StudentBoardSyncResponse | null {
  if (!isRecord(value)) return null;
  if (value.ok !== true) return null;
  if (typeof value.requestId !== "string" || !value.requestId) return null;
  if (typeof value.boardId !== "string" || !value.boardId) return null;
  if (typeof value.shareCode !== "string" || !value.shareCode) return null;
  if (!isStudentBoardModelShape(value.model)) return null;
  if (!isStudentRuntimeAuthority(value)) return null;
  if (typeof value.syncedAt !== "string" || !value.syncedAt) return null;
  if (
    value.stateVersion !== undefined &&
    (
      typeof value.stateVersion !== "number" ||
      !Number.isInteger(value.stateVersion) ||
      value.stateVersion < 0
    )
  ) {
    return null;
  }

  return value as StudentBoardSyncResponse;
}
