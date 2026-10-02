export type SearchableBoard = {
  title: string;
};

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

export function filterBoardsByQuery<T extends SearchableBoard>(boards: T[], query: string): T[] {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return boards;
  }

  return boards.filter((board) => normalizeTitle(board.title).includes(normalizedQuery));
}

