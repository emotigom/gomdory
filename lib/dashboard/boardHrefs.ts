import { routes } from "@/lib/standards/routes";

export function boardHubHref(boardId: string): string {
  return routes.page.dashboard.board(boardId);
}

export function boardClassHref(boardId: string): string {
  return routes.page.dashboard.boardClass(boardId);
}

export function boardBoardHref(boardId: string): string {
  return routes.page.dashboard.boardBoard(boardId);
}

export function boardGridHref(boardId: string): string {
  return routes.page.dashboard.boardGrid(boardId);
}

export function boardRemoteHref(boardId: string): string {
  return routes.page.dashboard.boardRemote(boardId);
}

export function boardPresentHref(boardId: string): string {
  return `${routes.page.dashboard.board(boardId)}#projector`;
}
