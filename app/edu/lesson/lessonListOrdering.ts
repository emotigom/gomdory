export type LessonCard = {
  id: number;
  title?: string | null;
};

const CORE_LESSON_ORDER = [1, 2, 3, 4] as const;
const FREE_MODE_ID = 0;

function getLessonSortRank(id: number): number {
  const orderIndex = CORE_LESSON_ORDER.indexOf(id as (typeof CORE_LESSON_ORDER)[number]);
  if (orderIndex >= 0) {
    return orderIndex;
  }
  return Number.MAX_SAFE_INTEGER;
}

export function splitLessonCards(cards: LessonCard[]): { coreLessons: LessonCard[]; freeMode: LessonCard | null } {
  const indexedCards = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => Number.isInteger(card.id));

  const freeModeEntry = indexedCards.find(({ card }) => card.id === FREE_MODE_ID) ?? null;
  const freeMode = freeModeEntry
    ? {
        ...freeModeEntry.card,
        title: freeModeEntry.card.title?.trim() || "자유모드 · 빈 페이지",
      }
    : null;

  const uniqueByLessonId = new Set<number>();
  const coreLessons = indexedCards
    .filter(({ card }) => card.id !== FREE_MODE_ID)
    .filter(({ card }) => {
      if (uniqueByLessonId.has(card.id)) {
        return false;
      }
      uniqueByLessonId.add(card.id);
      return true;
    })
    .sort((a, b) => {
      const rankDiff = getLessonSortRank(a.card.id) - getLessonSortRank(b.card.id);
      return rankDiff !== 0 ? rankDiff : a.index - b.index;
    })
    .map(({ card }) => ({
      ...card,
      title: card.title?.trim() || `${card.id}교시`,
    }));

  return { coreLessons, freeMode };
}
