"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export const ONBOARDING_CHECKLIST_STORAGE_KEY = "gomdory:onboarding:checklist:v1";

export type OnboardingChecklistState = {
  boardCreated: boolean;
  shareOpened: boolean;
  presentOpened: boolean;
};

const DEFAULT_STATE: OnboardingChecklistState = {
  boardCreated: false,
  shareOpened: false,
  presentOpened: false,
};

function readChecklistState(): OnboardingChecklistState {
  if (typeof window === "undefined") {
    return DEFAULT_STATE;
  }

  try {
    const stored = window.localStorage.getItem(ONBOARDING_CHECKLIST_STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored) as Partial<OnboardingChecklistState>;
    return {
      boardCreated: Boolean(parsed.boardCreated),
      shareOpened: Boolean(parsed.shareOpened),
      presentOpened: Boolean(parsed.presentOpened),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeChecklistState(state: OnboardingChecklistState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ONBOARDING_CHECKLIST_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // ignore storage errors
  }
}

export function useOnboardingChecklistState(boardCount: number) {
  const [state, setState] = useState<OnboardingChecklistState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readChecklistState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeChecklistState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    if (boardCount > 0) {
      setState((prev) =>
        prev.boardCreated ? prev : { ...prev, boardCreated: true },
      );
    }
  }, [boardCount, hydrated]);

  const markShareOpened = useCallback(() => {
    setState((prev) => (prev.shareOpened ? prev : { ...prev, shareOpened: true }));
  }, []);

  const markPresentOpened = useCallback(() => {
    setState((prev) => (prev.presentOpened ? prev : { ...prev, presentOpened: true }));
  }, []);

  const completed = useMemo(
    () => state.boardCreated && state.shareOpened && state.presentOpened,
    [state.boardCreated, state.presentOpened, state.shareOpened],
  );

  return { state, completed, hydrated, markShareOpened, markPresentOpened } as const;
}
