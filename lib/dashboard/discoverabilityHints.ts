export type HintGateInput = {
  enabled: boolean;
  hasSeen: boolean;
};

export function shouldShowHint(input: HintGateInput): boolean {
  return input.enabled && !input.hasSeen;
}

export function readHintSeen(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markHintSeen(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // fail-open: storage failure must not block core actions
  }
}
