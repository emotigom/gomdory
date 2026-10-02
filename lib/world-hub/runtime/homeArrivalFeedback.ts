"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

const HOME_ZONE_APPROACH_RADIUS = 16;
const HOME_ZONE_ARRIVAL_RADIUS = 9;
const ARRIVAL_FEEDBACK_COOLDOWN_MS = 45_000;
const ARRIVAL_FEEDBACK_DURATION_MS = 3_800;
const RETURN_FEEDBACK_DURATION_MS = 5_200;
const RETURN_FEEDBACK_STORAGE_PREFIX = "world-hub:return-feedback:";
const ARRIVAL_FEEDBACK_STORAGE_KEY = "world-hub:last-home-arrival-feedback-at";

export type WorldHubHomeZoneState = "away" | "approaching" | "arrived";

export type WorldHubAmbientFeedback = {
  kind: "arrival" | "return";
  eyebrow: string;
  title: string;
  detail: string;
  tone: "home" | "return";
  chips: string[];
};

function distanceBetween(a: WorldHubPoint, b: WorldHubPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getClosestHomeAnchorDistance(args: {
  playerPosition: WorldHubPoint;
  spawnPosition: WorldHubPoint;
  kioskPosition: WorldHubPoint;
}) {
  return Math.min(
    distanceBetween(args.playerPosition, args.spawnPosition),
    distanceBetween(args.playerPosition, args.kioskPosition),
  );
}

export function resolveWorldHubHomeZoneState(args: {
  playerPosition: WorldHubPoint;
  spawnPosition: WorldHubPoint;
  kioskPosition: WorldHubPoint;
}): WorldHubHomeZoneState {
  const distance = getClosestHomeAnchorDistance(args);

  if (distance <= HOME_ZONE_ARRIVAL_RADIUS) {
    return "arrived";
  }

  if (distance <= HOME_ZONE_APPROACH_RADIUS) {
    return "approaching";
  }

  return "away";
}

function getArrivalFeedbackForZone(zone: Extract<WorldHubHomeZoneState, "approaching" | "arrived">): WorldHubAmbientFeedback {
  if (zone === "arrived") {
    return {
      kind: "arrival",
      eyebrow: "홈",
      title: "모닥불 곁으로 돌아왔어요",
      detail: "베이스캠프가 준비되어 있어요. 잠깐 숨을 고르고, 마음이 가는 길을 골라 보세요.",
      tone: "home",
      chips: ["홈 공간", "차분한 리셋"],
    };
  }

  return {
    kind: "arrival",
    eyebrow: "홈",
    title: "모닥불이 가까워요",
    detail: "홈 공간이 가까워요. 다음 모험 전, 이곳에서 마음을 정돈해 보세요.",
    tone: "home",
    chips: ["홈 근처"],
  };
}

export function createWarmReturnFeedback(args: {
  recentMissionResult: WorldHubMissionResultReturnEnvelope;
}): WorldHubAmbientFeedback {
  const { recentMissionResult } = args;

  return {
    kind: "return",
    eyebrow: "다시 돌아왔어요",
    title: `${recentMissionResult.payload.missionTitle} 여정을 잘 마쳤어요`,
    detail:
      recentMissionResult.payload.integrations.persistence === "persisted"
        ? "기록이 캠프에 안전하게 담겼어요. 다음 길은 천천히 골라도 괜찮아요."
        : recentMissionResult.payload.integrations.persistence === "fallback-local"
          ? "기록이 이 기기에 안전하게 저장되었어요. 베이스캠프도 반갑게 맞이하고 있어요."
          : "기록을 캠프로 정리하는 중이에요. 잠시 쉬면서 다음 흐름을 기다려도 좋아요.",
    tone: "return",
    chips: [recentMissionResult.ack.completionLabel, recentMissionResult.ack.rewardLabel],
  };
}

function readSessionStorageValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in preview-safe environments.
  }
}

export function useWorldHubHomeArrivalFeedback(args: {
  runtime: WorldHubRuntimeInputs | null;
  playerPosition: WorldHubPoint | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
}) {
  const [activeFeedback, setActiveFeedback] = useState<WorldHubAmbientFeedback | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousZoneRef = useRef<WorldHubHomeZoneState>("away");

  const homeZoneState = useMemo<WorldHubHomeZoneState>(() => {
    if (!args.runtime || !args.playerPosition) {
      return "away";
    }

    return resolveWorldHubHomeZoneState({
      playerPosition: args.playerPosition,
      spawnPosition: args.runtime.spawn.position,
      kioskPosition: args.runtime.kiosk.position,
    });
  }, [args.playerPosition, args.runtime]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previousZone = previousZoneRef.current;
    previousZoneRef.current = homeZoneState;

    if (!args.runtime || homeZoneState === "away") {
      return;
    }

    const enteredNewZone = previousZone !== homeZoneState;
    const returnKey = args.recentMissionResult
      ? `${RETURN_FEEDBACK_STORAGE_PREFIX}${args.recentMissionResult.payload.missionId}:${args.recentMissionResult.payload.completedAtIso}`
      : null;
    const hasSeenReturnFeedback = returnKey ? readSessionStorageValue(returnKey) === "1" : false;

    const showFeedback = (feedback: WorldHubAmbientFeedback, durationMs: number) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      setActiveFeedback(feedback);
      hideTimeoutRef.current = setTimeout(() => {
        setActiveFeedback((current) => (current === feedback ? null : current));
      }, durationMs);
    };

    if (args.recentMissionResult && homeZoneState === "arrived" && !hasSeenReturnFeedback) {
      showFeedback(createWarmReturnFeedback({ recentMissionResult: args.recentMissionResult }), RETURN_FEEDBACK_DURATION_MS);
      if (returnKey) {
        writeSessionStorageValue(returnKey, "1");
      }
      writeSessionStorageValue(ARRIVAL_FEEDBACK_STORAGE_KEY, String(Date.now()));
      return;
    }

    if (!enteredNewZone || activeFeedback?.kind === "return") {
      return;
    }

    const lastArrivalFeedbackAt = Number(readSessionStorageValue(ARRIVAL_FEEDBACK_STORAGE_KEY) ?? "0");
    if (Number.isFinite(lastArrivalFeedbackAt) && Date.now() - lastArrivalFeedbackAt < ARRIVAL_FEEDBACK_COOLDOWN_MS) {
      return;
    }

    const feedback = getArrivalFeedbackForZone(homeZoneState);
    showFeedback(feedback, ARRIVAL_FEEDBACK_DURATION_MS);
    writeSessionStorageValue(ARRIVAL_FEEDBACK_STORAGE_KEY, String(Date.now()));
  }, [activeFeedback?.kind, args.recentMissionResult, args.runtime, homeZoneState]);

  return {
    activeFeedback,
    homeZoneState,
  };
}
