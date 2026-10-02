export function toggleBoardSelection(selectedIds: string[], boardId: string): string[] {
  if (!boardId) return selectedIds;
  if (selectedIds.includes(boardId)) {
    return selectedIds.filter((id) => id !== boardId);
  }
  return [...selectedIds, boardId];
}

export function computeSelectedBoardIds(selectedIds: string[], candidateBoardIds: string[]): string[] {
  if (candidateBoardIds.length === 0) return [];
  const candidateSet = new Set(candidateBoardIds);
  return selectedIds.filter((id) => candidateSet.has(id));
}

export function isBulkDeleteConfirmationValid(input: string, count: number): boolean {
  if (count <= 1) return true;
  return input.trim() === "삭제";
}
