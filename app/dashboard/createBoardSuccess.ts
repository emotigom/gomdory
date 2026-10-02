import type { CreateBoardState } from "./actions";

export const DASHBOARD_CREATE_BOARD_SUCCESS_EVENT = "dashboard:create-board-success";

export type DashboardCreateBoardSuccessDetail = {
  boardId: string;
  title: string;
  createdAt: string;
};

export function getCreateBoardSuccessDetail(state: CreateBoardState): DashboardCreateBoardSuccessDetail | null {
  if (!state.success) {
    return null;
  }

  const boardId = state.board?.boardId?.trim();
  if (!boardId) {
    return null;
  }

  const normalizedTitle = state.board?.title?.trim() || "제목 없는 보드";
  const createdAt = state.board?.created_at ?? new Date().toISOString();

  return {
    boardId,
    title: normalizedTitle,
    createdAt,
  };
}
