export type OptimisticRemovalResult<T> = {
  next: T[];
  removed: T | null;
  removedIndex: number;
};

export function removeOptimisticAttachmentById<T extends { id: string }>(
  items: readonly T[],
  targetId: string,
): OptimisticRemovalResult<T> {
  const removedIndex = items.findIndex((item) => item.id === targetId);

  if (removedIndex < 0) {
    return {
      next: [...items],
      removed: null,
      removedIndex: -1,
    };
  }

  return {
    next: items.filter((item) => item.id !== targetId),
    removed: items[removedIndex] ?? null,
    removedIndex,
  };
}

