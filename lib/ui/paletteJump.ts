export type PaletteJumpCardLike = {
  id: string;
  text: string;
};

export type PaletteJumpItem = {
  id: string;
  title: string;
};

export function resolveCardTitle(text: string): string {
  return text.split("\n")[0]?.trim() || "제목 없음";
}

export function buildCardJumpPaletteItems(
  cards: ReadonlyArray<PaletteJumpCardLike>,
  titleCache: Map<string, string>,
): PaletteJumpItem[] {
  const deduped = new Map<string, PaletteJumpItem>();
  for (const card of cards) {
    const cached = titleCache.get(card.id);
    const title = cached ?? resolveCardTitle(card.text);
    if (!cached) {
      titleCache.set(card.id, title);
    }
    if (!deduped.has(card.id)) {
      deduped.set(card.id, { id: card.id, title });
    }
  }
  return Array.from(deduped.values());
}

export function shouldBuildCardJumpList(input: { isPaletteOpen: boolean; hasBuilt: boolean; isDirty: boolean }): boolean {
  if (!input.isPaletteOpen) return false;
  if (!input.hasBuilt) return true;
  return input.isDirty;
}
