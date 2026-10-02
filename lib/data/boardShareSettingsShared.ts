export type StudentDefaultView = "wall" | "gallery" | "columns" | "stream";

export type BoardShareSettings = {
  studentDefaultView: StudentDefaultView;
};

export const DEFAULT_BOARD_SHARE_SETTINGS: BoardShareSettings = {
  studentDefaultView: "wall",
};

const LEGACY_VIEW_MAP: Record<string, StudentDefaultView> = {
  feed: "stream",
  walls: "wall",
  wall: "wall",
  grid: "wall",
};

export function parseStudentDefaultView(value: unknown): StudentDefaultView | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized === "wall" || normalized === "gallery" || normalized === "columns" || normalized === "stream") {
    return normalized as StudentDefaultView;
  }
  return LEGACY_VIEW_MAP[normalized] ?? null;
}
