type DashboardSortableBoard = {
  id: string;
  createdAt: string;
  lastUpdatedAt?: string | null;
};

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function sortBoardsForDashboard<T extends DashboardSortableBoard>(
  boards: readonly T[],
  lastOpenedBoardId: string | null,
  pinnedBoardIds: readonly string[] = [],
): T[] {
  const pinnedSet = new Set(pinnedBoardIds);

  return [...boards].sort((a, b) => {
    const aLastOpened = lastOpenedBoardId !== null && a.id === lastOpenedBoardId;
    const bLastOpened = lastOpenedBoardId !== null && b.id === lastOpenedBoardId;

    if (aLastOpened !== bLastOpened) {
      return aLastOpened ? -1 : 1;
    }

    const aPinned = pinnedSet.has(a.id);
    const bPinned = pinnedSet.has(b.id);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    const updatedDiff = toTimestamp(b.lastUpdatedAt) - toTimestamp(a.lastUpdatedAt);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    const createdDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return a.id.localeCompare(b.id);
  });
}

export type { DashboardSortableBoard };
