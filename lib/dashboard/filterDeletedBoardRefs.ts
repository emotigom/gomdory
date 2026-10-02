type BoardRefsInput = {
  boardIds: readonly string[];
  lastOpenedBoardId: string | null;
  pinnedBoardIds: readonly string[];
};

export type FilteredBoardRefs = {
  lastOpenedBoardId: string | null;
  pinnedBoardIds: string[];
  changed: boolean;
};

export function filterDeletedBoardReferences(input: BoardRefsInput): FilteredBoardRefs {
  const boardIdSet = new Set(input.boardIds);
  const pinnedBoardIds = input.pinnedBoardIds.filter((boardId) => boardIdSet.has(boardId));
  const lastOpenedBoardId =
    input.lastOpenedBoardId && boardIdSet.has(input.lastOpenedBoardId) ? input.lastOpenedBoardId : null;

  const changed =
    lastOpenedBoardId !== input.lastOpenedBoardId ||
    pinnedBoardIds.length !== input.pinnedBoardIds.length ||
    pinnedBoardIds.some((boardId, index) => boardId !== input.pinnedBoardIds[index]);

  return {
    lastOpenedBoardId,
    pinnedBoardIds,
    changed,
  };
}

