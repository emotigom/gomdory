import type { TeacherBoardMutationResult, TeacherBoardOperation } from "./teacherBoardMutationState";

export type TeacherCardMenuOperation = "hide" | "restore";
export type TeacherCardMenuAnnouncementKind =
  | "success"
  | "retryable-error"
  | "terminal-error";

export type TeacherCardMenuAnnouncement = {
  kind: TeacherCardMenuAnnouncementKind;
  operation: TeacherCardMenuOperation;
  eventKey: string;
  message: string;
};

const messages = {
  hide: "카드를 학생 화면에서 숨겼습니다.",
  restore: "카드를 학생 화면에 다시 표시했습니다.",
  "retryable-error": "카드 공개 상태를 바꾸지 못했어요. 다시 시도해주세요.",
  "terminal-error": "카드 공개 상태를 바꿀 수 없습니다.",
} as const;

export const createTeacherCardMenuAnnouncement = (
  operation: TeacherBoardOperation,
  visibilityOperation: TeacherCardMenuOperation,
  result: TeacherBoardMutationResult,
): TeacherCardMenuAnnouncement | null => {
  if (operation.kind !== "visibility") return null;

  if (result === "confirmed") {
    return {
      kind: "success",
      operation: visibilityOperation,
      eventKey: `${operation.id}:confirmed`,
      message: messages[visibilityOperation],
    };
  }

  if (result === "retryable-error" || result === "terminal-error") {
    return {
      kind: result,
      operation: visibilityOperation,
      eventKey: `${operation.id}:${result}`,
      message: messages[result],
    };
  }

  return null;
};
