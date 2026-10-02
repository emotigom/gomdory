"use client";

import { useEffect, useMemo, useState } from "react";

import type { MetaverseResolvedProgressSnapshot } from "@/lib/world-hub/progress/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

const HOME_ACK_STORAGE_PREFIX = "world-hub:home-anchor-ack:";

export type WorldHubHomeAnchorAcknowledgementView = {
  signature: string;
  origin: "recent-return" | "persisted-progress";
  eyebrow: string;
  title: string;
  detail: string;
  statusLabel: string;
  completionLabel: string;
  rewardLabel: string | null;
  emphasis: "fresh" | "settled";
};

function buildSignature(args: { missionId: string; completedAtIso: string }) {
  return `${args.missionId}:${args.completedAtIso}`;
}

function readStorageValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so local fallback behavior stays deterministic.
  }
}

export function resolveWorldHubHomeAnchorAcknowledgement(args: {
  progress: MetaverseResolvedProgressSnapshot | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  hasBeenSeen?: boolean;
}): WorldHubHomeAnchorAcknowledgementView | null {
  if (args.recentMissionResult) {
    const { payload, ack } = args.recentMissionResult;
    const signature = buildSignature({
      missionId: payload.missionId,
      completedAtIso: payload.completedAtIso,
    });

    return {
      signature,
      origin: "recent-return",
      eyebrow: args.hasBeenSeen ? "홈이 기억하고 있어요" : "다시 돌아왔어요",
      title: ack.title,
      detail:
        payload.integrations.persistence === "persisted"
          ? `베이스캠프가 돌아온 기록을 부드럽게 정리했어요. ${payload.rewards.summaryDetail}`
          : payload.integrations.persistence === "fallback-local"
            ? `이 기기에서 돌아온 기록을 안전하게 보관했어요. ${payload.rewards.summaryDetail}`
            : `돌아온 기록을 베이스캠프에 정리하고 있어요. ${payload.rewards.summaryDetail}`,
      statusLabel: ack.integrationLabel,
      completionLabel: ack.completionLabel,
      rewardLabel: ack.rewardLabel,
      emphasis: args.hasBeenSeen ? "settled" : "fresh",
    };
  }

  const persistedAck = args.progress?.homeAcknowledgement;
  if (!persistedAck) {
    return null;
  }

  return {
    signature: buildSignature({
      missionId: persistedAck.missionId,
      completedAtIso: persistedAck.completedAtIso,
    }),
    origin: "persisted-progress",
    eyebrow: args.hasBeenSeen ? "홈이 기억하고 있어요" : "이곳이 기억하고 있어요",
    title: persistedAck.title,
    detail: persistedAck.detail,
    statusLabel: persistedAck.persistenceLabel,
    completionLabel: persistedAck.completionLabel,
    rewardLabel: persistedAck.rewardLabel,
    emphasis: args.hasBeenSeen ? "settled" : "fresh",
  };
}

export function useWorldHubHomeAnchorAcknowledgement(args: {
  worldId: string | null;
  progress: MetaverseResolvedProgressSnapshot | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
}) {
  const storageKey = useMemo(() => {
    return `${HOME_ACK_STORAGE_PREFIX}${args.worldId ?? "world-hub"}`;
  }, [args.worldId]);

  const [seenSignature, setSeenSignature] = useState<string | null>(null);
  const [freshSignature, setFreshSignature] = useState<string | null>(null);

  useEffect(() => {
    const nextSeenSignature = readStorageValue(storageKey);
    setSeenSignature(nextSeenSignature);
  }, [storageKey]);

  const nextSignature = useMemo(() => {
    if (args.recentMissionResult) {
      return buildSignature({
        missionId: args.recentMissionResult.payload.missionId,
        completedAtIso: args.recentMissionResult.payload.completedAtIso,
      });
    }

    if (args.progress?.homeAcknowledgement) {
      return buildSignature({
        missionId: args.progress.homeAcknowledgement.missionId,
        completedAtIso: args.progress.homeAcknowledgement.completedAtIso,
      });
    }

    return null;
  }, [args.progress, args.recentMissionResult]);

  useEffect(() => {
    if (!nextSignature || seenSignature === nextSignature) {
      return;
    }

    setFreshSignature(nextSignature);
    writeStorageValue(storageKey, nextSignature);
    setSeenSignature(nextSignature);
  }, [nextSignature, seenSignature, storageKey]);

  const acknowledgement = useMemo(() => {
    return resolveWorldHubHomeAnchorAcknowledgement({
      progress: args.progress,
      recentMissionResult: args.recentMissionResult,
      hasBeenSeen: !nextSignature ? true : freshSignature !== nextSignature,
    });
  }, [args.progress, args.recentMissionResult, freshSignature, nextSignature]);

  return {
    acknowledgement,
  };
}
