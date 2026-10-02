export type CardPositionMoveRow = {
  id: string;
  wall_id: string;
  position: number | null;
  created_at: string | null;
};

export type NormalizedCardMoveWallOrder = {
  wallId: string;
  cards: CardPositionMoveRow[];
};

export function compareCardPositionRows(a: CardPositionMoveRow, b: CardPositionMoveRow) {
  const aPosition = typeof a.position === "number" && Number.isFinite(a.position) ? a.position : null;
  const bPosition = typeof b.position === "number" && Number.isFinite(b.position) ? b.position : null;

  if (aPosition !== null && bPosition !== null && aPosition !== bPosition) {
    return aPosition - bPosition;
  }
  if (aPosition !== null && bPosition === null) return -1;
  if (aPosition === null && bPosition !== null) return 1;

  const createdCompare = Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
  if (Number.isFinite(createdCompare) && createdCompare !== 0) return createdCompare;
  return b.id.localeCompare(a.id);
}

export function clampTargetCardPosition(position: number | null, max: number) {
  if (position === null) return max;
  return Math.min(Math.max(Math.trunc(position), 0), max);
}

export function buildNormalizedCardMove(input: {
  rows: CardPositionMoveRow[];
  cardId: string;
  fromWallId: string;
  targetWallId: string;
  position: number | null;
}): NormalizedCardMoveWallOrder[] {
  const rows = [...input.rows].sort(compareCardPositionRows);
  const movingCard = rows.find((card) => card.id === input.cardId);

  if (!movingCard) {
    throw new Error("card_move_failed");
  }

  if (input.fromWallId === input.targetWallId) {
    const sameWallCards = rows.filter((card) => card.wall_id === input.targetWallId && card.id !== input.cardId);
    sameWallCards.splice(clampTargetCardPosition(input.position, sameWallCards.length), 0, {
      ...movingCard,
      wall_id: input.targetWallId,
    });
    return [{ wallId: input.targetWallId, cards: sameWallCards }];
  }

  const sourceWallCards = rows.filter((card) => card.wall_id === input.fromWallId && card.id !== input.cardId);
  const targetWallCards = rows.filter((card) => card.wall_id === input.targetWallId);
  targetWallCards.splice(clampTargetCardPosition(input.position, targetWallCards.length), 0, {
    ...movingCard,
    wall_id: input.targetWallId,
  });

  return [
    { wallId: input.fromWallId, cards: sourceWallCards },
    { wallId: input.targetWallId, cards: targetWallCards },
  ];
}
