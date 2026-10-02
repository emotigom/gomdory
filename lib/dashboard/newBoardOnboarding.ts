import { apiV1Path } from "@/lib/standards/pathTypes";

const CREATED_BOARD_ID_SESSION_KEY = "gom:dashboard:new-board-onboarding:created-board-id";
const DISMISSED_PREF_KEY = "hasDismissedNewBoardOnboarding";

export function normalizeHasDismissedNewBoardOnboarding(input: unknown): boolean {
  return typeof input === "boolean" ? input : false;
}

export function resolveHasDismissedNewBoardOnboardingFromPrefs(classPrefs: unknown): boolean {
  if (!classPrefs || typeof classPrefs !== "object") {
    return false;
  }

  return normalizeHasDismissedNewBoardOnboarding((classPrefs as Record<string, unknown>)[DISMISSED_PREF_KEY]);
}

export function shouldShowNewBoardOnboarding(params: {
  hasDismissed: boolean;
  boardId: string | null | undefined;
  createdBoardId: string | null | undefined;
}): boolean {
  if (params.hasDismissed) {
    return false;
  }

  const boardId = params.boardId?.trim() ?? "";
  const createdBoardId = params.createdBoardId?.trim() ?? "";
  if (!boardId || !createdBoardId) {
    return false;
  }

  return boardId === createdBoardId;
}

export function setCreatedBoardIdForOnboarding(boardId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = boardId.trim();
  if (!normalized) {
    return;
  }

  try {
    window.sessionStorage.setItem(CREATED_BOARD_ID_SESSION_KEY, normalized);
  } catch {
    // ignore storage access errors
  }
}

export function getCreatedBoardIdForOnboarding(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(CREATED_BOARD_ID_SESSION_KEY);
    const normalized = value?.trim() ?? "";
    return normalized || null;
  } catch {
    return null;
  }
}

export function clearCreatedBoardIdForOnboarding(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(CREATED_BOARD_ID_SESSION_KEY);
  } catch {
    // ignore storage access errors
  }
}

export async function getHasDismissedNewBoardOnboarding(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const response = await fetch(apiV1Path("me/ui-prefs"), { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { prefs?: Record<string, unknown> };
    return normalizeHasDismissedNewBoardOnboarding(data?.prefs?.[DISMISSED_PREF_KEY]);
  } catch {
    return false;
  }
}

export async function setHasDismissedNewBoardOnboarding(input: boolean): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const response = await fetch(apiV1Path("me/ui-prefs"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classPrefs: { [DISMISSED_PREF_KEY]: normalizeHasDismissedNewBoardOnboarding(input) } }),
      keepalive: true,
    });

    return response.ok;
  } catch {
    return false;
  }
}
