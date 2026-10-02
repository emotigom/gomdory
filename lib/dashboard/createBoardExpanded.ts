import { apiV1Path } from "@/lib/standards/pathTypes";

const CREATE_BOARD_EXPANDED_KEY = "isCreateBoardExpanded";

export function normalizeCreateBoardExpanded(input: unknown): boolean {
  return typeof input === "boolean" ? input : false;
}

export async function getCreateBoardExpanded(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const response = await fetch(apiV1Path("me/ui-prefs"), { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { ok?: boolean; prefs?: Record<string, unknown> };
    return normalizeCreateBoardExpanded(data?.prefs?.[CREATE_BOARD_EXPANDED_KEY]);
  } catch {
    return false;
  }
}

export async function setCreateBoardExpanded(isExpanded: boolean): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const response = await fetch(apiV1Path("me/ui-prefs"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classPrefs: { isCreateBoardExpanded: normalizeCreateBoardExpanded(isExpanded) } }),
      keepalive: true,
    });

    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.debug("[dashboard] failed to persist isCreateBoardExpanded", { status: response.status, isExpanded });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[dashboard] failed to persist isCreateBoardExpanded", { isExpanded, error });
    }
  }
}
