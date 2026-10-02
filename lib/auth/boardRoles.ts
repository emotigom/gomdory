export type BoardRole = "owner" | "editor" | "viewer";

export function isBoardRole(value: unknown): value is BoardRole {
  return value === "owner" || value === "editor" || value === "viewer";
}

export function normalizeBoardRole(value: unknown): BoardRole | null {
  return isBoardRole(value) ? value : null;
}

const BOARD_ROLE_RANK: Record<BoardRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export function compareBoardRole(a: BoardRole | null, b: BoardRole | null): number {
  const left = a ? BOARD_ROLE_RANK[a] : 0;
  const right = b ? BOARD_ROLE_RANK[b] : 0;
  return left - right;
}

export function canEditBoard(role: BoardRole | null): boolean {
  return role === "owner" || role === "editor";
}
