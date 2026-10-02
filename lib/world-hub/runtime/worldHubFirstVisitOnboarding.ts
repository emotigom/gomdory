"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FIRST_VISIT_ONBOARDING_STORAGE_PREFIX = "world-hub:first-visit-onboarding:";
const FIRST_VISIT_ONBOARDING_AUTO_SETTLE_MS = 6_500;
const FIRST_VISIT_ONBOARDING_MOVEMENT_SETTLE_SPEED = 1.15;

export type WorldHubFirstVisitOnboardingPhase = "hidden" | "expanded" | "compact";

export type WorldHubFirstVisitOnboardingView = {
  phase: WorldHubFirstVisitOnboardingPhase;
  title: string;
  body: string;
  controls: [string, string, string];
  compactLabel: string;
  dismissLabel: string;
};

export const WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY: Omit<WorldHubFirstVisitOnboardingView, "phase"> = {
  title: "숲속 모험 베이스캠프에 도착했어요",
  body: "여기서 준비하고, 오늘의 모험을 고르고, 다시 돌아올 수 있어요.",
  controls: [
    "WASD / 방향키로 이동",
    "가까이 가면 다음 안내가 보여요",
    "포털 앞에서는 Enter, 가까운 표식은 E로 이어가기",
  ],
  compactLabel: "이동 WASD/방향키 · 가까이 가면 안내",
  dismissLabel: "닫기",
};

function readLocalStorageValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore local storage failures for preview-safe runtime behavior.
  }
}

export function resolveWorldHubFirstVisitOnboardingPhase(args: {
  isFirstVisit: boolean;
  settled: boolean;
  dismissed: boolean;
}): WorldHubFirstVisitOnboardingPhase {
  if (!args.isFirstVisit || args.dismissed) {
    return "hidden";
  }

  return args.settled ? "compact" : "expanded";
}

export function useWorldHubFirstVisitOnboarding(args: {
  worldId: string | null;
  movementSpeed: number;
}) {
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [settled, setSettled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const autoSettleTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const storageKey = useMemo(
    () => `${FIRST_VISIT_ONBOARDING_STORAGE_PREFIX}${args.worldId ?? "world-hub"}`,
    [args.worldId],
  );

  useEffect(() => {
    if (!args.worldId) {
      setIsFirstVisit(false);
      setSettled(false);
      setDismissed(false);
      return;
    }

    const hasSeen = readLocalStorageValue(storageKey) === "seen";
    if (hasSeen) {
      setIsFirstVisit(false);
      setSettled(false);
      setDismissed(false);
      return;
    }

    setIsFirstVisit(true);
    setSettled(false);
    setDismissed(false);
    writeLocalStorageValue(storageKey, "seen");
  }, [args.worldId, storageKey]);

  useEffect(() => {
    if (!isFirstVisit || dismissed || settled) {
      return;
    }

    autoSettleTimeoutRef.current = setTimeout(() => {
      setSettled(true);
    }, FIRST_VISIT_ONBOARDING_AUTO_SETTLE_MS);

    return () => {
      if (!autoSettleTimeoutRef.current) {
        return;
      }
      clearTimeout(autoSettleTimeoutRef.current);
      autoSettleTimeoutRef.current = null;
    };
  }, [dismissed, isFirstVisit, settled]);

  useEffect(() => {
    if (!isFirstVisit || dismissed || settled) {
      return;
    }

    if (args.movementSpeed >= FIRST_VISIT_ONBOARDING_MOVEMENT_SETTLE_SPEED) {
      setSettled(true);
    }
  }, [args.movementSpeed, dismissed, isFirstVisit, settled]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const phase = resolveWorldHubFirstVisitOnboardingPhase({
    isFirstVisit,
    settled,
    dismissed,
  });

  return {
    view: {
      ...WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY,
      phase,
    } satisfies WorldHubFirstVisitOnboardingView,
    dismiss,
  };
}
