import type { StudentBoardItem } from "@/lib/student/normalizeStudentItems";

export type StudentBoardFilter = "all" | "text" | "image" | "file" | "question" | "notice";
export type StudentBoardSort = "new" | "old";

type FilterOptions = {
  query: string;
  filter: StudentBoardFilter;
  sort: StudentBoardSort;
};

const matchesFilter = (item: StudentBoardItem, filter: StudentBoardFilter) => {
  if (filter === "all") return true;
  if (filter === "image") return item.kind === "image";
  if (filter === "file") return item.kind === "file";
  if (filter === "question") return item.kind === "question";
  if (filter === "notice") return item.kind === "notice";
  if (filter === "text") {
    return item.kind !== "image" && item.kind !== "file";
  }
  return true;
};

export const sortStudentBoardItems = (items: StudentBoardItem[], sort: StudentBoardSort) => {
  const sorted = [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return sort === "old" ? aTime - bTime : bTime - aTime;
  });
  return sorted;
};

export const applyStudentBoardFilters = (items: StudentBoardItem[], { query, filter, sort }: FilterOptions) => {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!matchesFilter(item, filter)) return false;
    if (!normalizedQuery) return true;
    return item.searchText.includes(normalizedQuery);
  });
  return sortStudentBoardItems(filtered, sort);
};
