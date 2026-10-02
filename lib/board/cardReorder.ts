export type ReorderableCard = { id: string; wall_id?: string; student?: { isOwnCard?: boolean }; author_client_id?: string | null; meta?: { authorClientId?: string | null } };

export type ReorderableWallEntry<TCard extends { id: string }> = {
  wall: { id: string };
  cards: TCard[];
};

export function moveCardAcrossWalls<TCard extends { id: string }>(input: {
  entries: ReorderableWallEntry<TCard>[];
  cardId: string;
  toWallId: string;
  toIndex: number;
}) {
  const { entries, cardId, toWallId, toIndex } = input;
  const next = entries.map((entry) => ({ ...entry, cards: [...entry.cards] }));

  let fromWallId: string | null = null;
  let movedCard: TCard | null = null;

  for (const entry of next) {
    const index = entry.cards.findIndex((card) => card.id === cardId);
    if (index >= 0) {
      movedCard = entry.cards.splice(index, 1)[0] ?? null;
      fromWallId = entry.wall.id;
      break;
    }
  }

  if (!movedCard) {
    return { entries, changed: false, fromWallId: null as string | null };
  }

  const target = next.find((entry) => entry.wall.id === toWallId);
  if (!target) {
    return { entries, changed: false, fromWallId };
  }

  const boundedIndex = Math.max(0, Math.min(toIndex, target.cards.length));
  target.cards.splice(boundedIndex, 0, movedCard);

  return { entries: next, changed: true, fromWallId };
}

export function canReorderShareCard(cardAuthorClientId: string | null | undefined, viewerClientId: string | null | undefined) {
  if (!cardAuthorClientId || !viewerClientId) return false;
  return cardAuthorClientId === viewerClientId;
}
