export type GuidedPathId = "blank_board" | "template_start" | "first_lesson";

const GUIDED_PATH_KEY = "gomdori:guided-start:selected-path:v1";

type StoredGuidedPath = {
  pathId: GuidedPathId;
  source: string;
  selectedAt: string;
};

export function setGuidedPathSelection(pathId: GuidedPathId, source: string) {
  if (typeof window === "undefined") return;
  const payload: StoredGuidedPath = {
    pathId,
    source,
    selectedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(GUIDED_PATH_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function getGuidedPathSelection(): StoredGuidedPath | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUIDED_PATH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredGuidedPath>;
    if (!parsed || (parsed.pathId !== "blank_board" && parsed.pathId !== "template_start" && parsed.pathId !== "first_lesson")) {
      return null;
    }
    return {
      pathId: parsed.pathId,
      source: typeof parsed.source === "string" ? parsed.source : "unknown",
      selectedAt: typeof parsed.selectedAt === "string" ? parsed.selectedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
