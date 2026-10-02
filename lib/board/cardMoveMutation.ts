export type CardMoveMutationRecord = {
  boardId: string;
  cardId: string;
  targetWallId: string;
};

export function isSameCardMoveMutation(
  existing: CardMoveMutationRecord,
  incoming: CardMoveMutationRecord,
): boolean {
  return (
    existing.boardId === incoming.boardId
    && existing.cardId === incoming.cardId
    && existing.targetWallId === incoming.targetWallId
  );
}
