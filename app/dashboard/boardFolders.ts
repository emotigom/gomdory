export type DashboardFolder = {
  id: string;
  name: string;
};

export type BoardFolderMap = Record<string, string>;

export const DEFAULT_DASHBOARD_FOLDERS: DashboardFolder[] = [
  { id: "class", name: "수업" },
  { id: "personal", name: "개인" },
];

export function normalizeFolders(input: unknown): DashboardFolder[] {
  if (!Array.isArray(input)) return [...DEFAULT_DASHBOARD_FOLDERS];
  const seen = new Set<string>();
  const normalized: DashboardFolder[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; name?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    normalized.push({ id, name });
  }
  return normalized.length > 0 ? normalized : [...DEFAULT_DASHBOARD_FOLDERS];
}

export function normalizeBoardFolderMap(input: unknown, folders: DashboardFolder[]): BoardFolderMap {
  if (!input || typeof input !== "object") return {};
  const validIds = new Set(folders.map((folder) => folder.id));
  const next: BoardFolderMap = {};
  for (const [boardId, folderId] of Object.entries(input as Record<string, unknown>)) {
    if (!boardId || typeof boardId !== "string") continue;
    if (typeof folderId !== "string") continue;
    if (!validIds.has(folderId)) continue;
    next[boardId] = folderId;
  }
  return next;
}

export function filterBoardsByFolder<T extends { boardId?: string | null }>(
  boards: T[],
  selectedFolderId: string,
  boardFolderMap: BoardFolderMap,
): T[] {
  if (selectedFolderId === "all") return boards;
  return boards.filter((board) => {
    if (!board.boardId) return false;
    return boardFolderMap[board.boardId] === selectedFolderId;
  });
}
