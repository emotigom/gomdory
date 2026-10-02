import { apiV1Path } from "@/lib/standards/pathTypes";

const LAST_OPENED_BOARD_ID_KEY = "lastOpenedBoardId";
const LAST_OPENED_BOARD_STORAGE_KEY = "gom:last-opened-board-id";

export function normalizeLastOpenedBoardId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveLastOpenedBoardIdFromPrefs(classPrefs: unknown): string | null {
  if (!classPrefs || typeof classPrefs !== "object") return null;
  return normalizeLastOpenedBoardId((classPrefs as Record<string, unknown>)[LAST_OPENED_BOARD_ID_KEY]);
}

export async function setLastOpenedBoardId(boardId: string): Promise<void> {
  const nextBoardId = normalizeLastOpenedBoardId(boardId);
  if (!nextBoardId || typeof window === "undefined") {
    return;
  }

  if (window.sessionStorage.getItem(LAST_OPENED_BOARD_STORAGE_KEY) === nextBoardId) {
    return;
  }

  window.sessionStorage.setItem(LAST_OPENED_BOARD_STORAGE_KEY, nextBoardId);
  const isDev = process.env.NODE_ENV !== "production";

  try {
    const response = await fetch(apiV1Path("me/ui-prefs"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastOpenedBoardId: nextBoardId }),
      keepalive: true,
    });

    if (!response.ok && isDev) {
      console.debug("[dashboard] failed to persist lastOpenedBoardId", {
        status: response.status,
        boardId: nextBoardId,
      });
    }
  } catch (error) {
    if (isDev) {
      console.debug("[dashboard] failed to persist lastOpenedBoardId", { boardId: nextBoardId, error });
    }
  }
}
