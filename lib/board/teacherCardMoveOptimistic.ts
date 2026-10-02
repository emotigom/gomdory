export type TeacherCardMoveEntry<TCard extends { id: string; position?: number | null }> = {
  wall: { id: string };
  cards: TCard[];
};

export type TeacherCardMoveResult<
  TCard extends { id: string; position?: number | null },
  TEntry extends TeacherCardMoveEntry<TCard> = TeacherCardMoveEntry<TCard>,
> = {
  entries: TEntry[];
  changed: boolean;
  fromWallId: string | null;
  fromPosition: number | null;
};

export function isNoopTeacherCardMove(input: {
  sourceWallId: string;
  sourcePosition: number;
  targetWallId: string;
  targetPosition: number;
}) {
  return (
    input.sourceWallId === input.targetWallId &&
    input.sourcePosition === input.targetPosition
  );
}

export function applyTeacherCardMoveOptimistic<
  TCard extends { id: string; position?: number | null },
  TEntry extends TeacherCardMoveEntry<TCard>,
>(input: {
  entries: TEntry[];
  cardId: string;
  targetWallId: string;
  targetPosition: number;
}): TeacherCardMoveResult<TCard, TEntry> {
  const next: TEntry[] = input.entries.map((entry) => ({
    ...entry,
    cards: [...entry.cards],
  }));
  let movedCard: TCard | null = null;
  let fromWallId: string | null = null;
  let fromPosition: number | null = null;

  for (const entry of next) {
    const cardIndex = entry.cards.findIndex((card) => card.id === input.cardId);
    if (cardIndex < 0) continue;
    movedCard = entry.cards.splice(cardIndex, 1)[0] ?? null;
    fromWallId = entry.wall.id;
    fromPosition = cardIndex;
    break;
  }

  if (!movedCard) {
    return {
      entries: input.entries,
      changed: false,
      fromWallId: null,
      fromPosition: null,
    };
  }

  const targetEntry = next.find((entry) => entry.wall.id === input.targetWallId);
  if (!targetEntry) {
    return {
      entries: input.entries,
      changed: false,
      fromWallId,
      fromPosition,
    };
  }

  const targetIndex = Math.min(
    Math.max(0, Math.trunc(input.targetPosition)),
    targetEntry.cards.length,
  );
  targetEntry.cards.splice(targetIndex, 0, movedCard);
  next.forEach((entry) => {
    entry.cards = normalizeCardPositions(entry.cards);
  });

  return {
    entries: next,
    changed: true,
    fromWallId,
    fromPosition,
  };
}

function normalizeCardPositions<TCard extends { id: string; position?: number | null }>(
  cards: TCard[],
) {
  return cards.map((card, position) => ({ ...card, position }));
}
