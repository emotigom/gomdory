export function pickFocusRestoreCardId(
  candidates: Array<string | null | undefined>,
  availableCardIds: string[],
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (availableCardIds.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function buildCardFocusSelector(cardId: string): string {
  return `[data-card-id="${cardId}"]`;
}
