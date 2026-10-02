import { apiV1Path } from "@/lib/standards/pathTypes";

const PINNED_BOARD_IDS_KEY = "pinnedBoardIds";

export function normalizePinnedBoardIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const deduped = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
  }

  return [...deduped];
}

export function resolvePinnedBoardIdsFromPrefs(classPrefs: unknown): string[] {
  if (!classPrefs || typeof classPrefs !== "object") return [];
  return normalizePinnedBoardIds((classPrefs as Record<string, unknown>)[PINNED_BOARD_IDS_KEY]);
}

export async function setPinnedBoardIds(pinnedBoardIds: string[]): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const response = await fetch(apiV1Path("me/ui-prefs"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classPrefs: { pinnedBoardIds: normalizePinnedBoardIds(pinnedBoardIds) } }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
