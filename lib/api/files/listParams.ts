export type FileListParams = {
  q: string | null;
  tag: string | null;
  boardId: string | null;
  type: "image" | "pdf" | "audio" | "video" | "any";
  cursor: string | null;
  limit: number;
  sort: "recent" | "name" | "size";
};

const DEFAULT_LIMIT = 24;

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(60, Math.max(1, value));
}

function normalizeString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseFilesListParams(searchParams: URLSearchParams): FileListParams {
  const q = normalizeString(searchParams.get("q") ?? searchParams.get("query"));
  const tag = normalizeString(searchParams.get("tag"));
  const boardId = normalizeString(searchParams.get("boardId"));
  const typeRaw = normalizeString(searchParams.get("type"));
  const type =
    typeRaw === "image" || typeRaw === "pdf" || typeRaw === "audio" || typeRaw === "video" || typeRaw === "any"
      ? typeRaw
      : "any";
  const cursor = normalizeString(searchParams.get("cursor"));
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = clampLimit(rawLimit);
  const sortRaw = normalizeString(searchParams.get("sort"));
  const sort = sortRaw === "name" || sortRaw === "size" || sortRaw === "recent" ? sortRaw : "recent";

  return { q, tag, boardId, type, cursor, limit, sort };
}
