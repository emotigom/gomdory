export type ComposeDraftKeyInput = {
  boardId: string;
  wallId: string;
  userId?: string;
};

export type ComposeDraftPayload = {
  text: string;
  url: string;
  updatedAt: number;
};

const STORAGE_PREFIX = "compose-draft";
const MAX_TEXT_LENGTH = 5_000;
const MAX_URL_LENGTH = 2_048;

type TimerRef = ReturnType<typeof setTimeout>;

export type DebounceTimerApi = {
  setTimeout: (callback: () => void, delayMs: number) => TimerRef;
  clearTimeout: (timerId: TimerRef) => void;
};

function normalizeSegment(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function makeDraftKey({ boardId, wallId, userId }: ComposeDraftKeyInput): string {
  const boardSegment = normalizeSegment(boardId);
  const wallSegment = normalizeSegment(wallId);
  const userSegment = userId ? normalizeSegment(userId) : "anon";
  return `${STORAGE_PREFIX}:${boardSegment}:${wallSegment}:${userSegment}`;
}

export function normalizeDraft(input: Pick<ComposeDraftPayload, "text" | "url">): Pick<ComposeDraftPayload, "text" | "url"> {
  const normalizedText = input.text.trim().slice(0, MAX_TEXT_LENGTH);
  const normalizedUrl = input.url.trim().slice(0, MAX_URL_LENGTH);
  return {
    text: normalizedText,
    url: normalizedUrl,
  };
}

export function saveDraft(
  key: string,
  payload: Pick<ComposeDraftPayload, "text" | "url" | "updatedAt">,
): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeDraft(payload);
  window.localStorage.setItem(
    key,
    JSON.stringify({
      ...normalized,
      updatedAt: payload.updatedAt,
    } satisfies ComposeDraftPayload),
  );
}

export function loadDraft(key: string): ComposeDraftPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ComposeDraftPayload>;
    if (typeof parsed.text !== "string" || typeof parsed.url !== "string") {
      return null;
    }

    const normalized = normalizeDraft({ text: parsed.text, url: parsed.url });
    return {
      ...normalized,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function createDebouncedSaver(
  callback: () => void,
  delayMs = 800,
  timerApi: DebounceTimerApi = {
    setTimeout: (nextCallback, timeoutMs) => setTimeout(nextCallback, timeoutMs),
    clearTimeout: (timerId) => clearTimeout(timerId),
  },
): {
  trigger: () => void;
  cancel: () => void;
} {
  let timerId: TimerRef | null = null;

  return {
    trigger: () => {
      if (timerId) {
        timerApi.clearTimeout(timerId);
      }
      timerId = timerApi.setTimeout(() => {
        timerId = null;
        callback();
      }, delayMs);
    },
    cancel: () => {
      if (!timerId) return;
      timerApi.clearTimeout(timerId);
      timerId = null;
    },
  };
}
