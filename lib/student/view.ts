export const STUDENT_VIEWS = ["wall", "columns", "gallery", "stream"] as const;

export type StudentView = (typeof STUDENT_VIEWS)[number];

const LEGACY_VIEW_MAP: Record<string, StudentView> = {
  wall: "wall",
  walls: "wall",
  grid: "wall",
  feed: "stream",
};

export const isStudentView = (value?: string | null): value is StudentView => {
  if (!value) return false;
  return STUDENT_VIEWS.includes(value as StudentView);
};

export const parseStudentView = (value?: string | null): StudentView | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (STUDENT_VIEWS.includes(normalized as StudentView)) {
    return normalized as StudentView;
  }
  return LEGACY_VIEW_MAP[normalized] ?? null;
};

export const normalizeStudentView = (value?: string | null): StudentView => {
  return parseStudentView(value) ?? "wall";
};
