import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import type { WorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";
import type { WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";

export type WorldHubJourneyPathGuidance = {
  status: "resting" | "suggested" | "active";
  source: "deterministic-fallback" | "resolved-runtime";
  eyebrow: string;
  title: string;
  detail: string;
  chipLabel: string;
  ambientLabel: string;
  accent: string;
  targetPortalId: string | null;
  targetPortalLabel: string | null;
  homePosition: { x: number; y: number } | null;
  targetPosition: { x: number; y: number } | null;
  trailProgress: readonly number[];
};

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return hash;
}

function resolveTrailProgress(seedValue: string) {
  const seed = hashSeed(seedValue);
  return [0.18, 0.34, 0.5, 0.66, 0.82].map((base, index) => {
    const jitter = (((seed + index * 17) % 7) - 3) * 0.006;
    return Math.min(0.9, Math.max(0.12, base + jitter));
  });
}

export function resolveWorldHubJourneyPathGuidance(args: {
  runtime: WorldHubRuntimeInputs | null;
  suggestion: WorldHubNextAdventureSuggestionCue;
  readiness: WorldHubNextAdventureReadinessCue;
  homeZoneState: WorldHubHomeZoneState;
}): WorldHubJourneyPathGuidance {
  if (!args.runtime || args.runtime.portals.length === 0) {
    return {
      status: "resting",
      source: "deterministic-fallback",
      eyebrow: "길 안내",
      title: "다음 길이 정해지면 안내 불빛이 맞춰져요",
      detail: "경로가 정해지는 동안 홈 공간은 차분한 분위기를 유지해요.",
      chipLabel: "길 안내 준비 중",
      ambientLabel: "길 안내 정돈",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
      homePosition: null,
      targetPosition: null,
      trailProgress: [],
    };
  }

  const targetPortalId = args.suggestion.targetPortalId ?? args.readiness.targetPortalId;
  const targetPortal =
    (targetPortalId ? args.runtime.portals.find((portal) => portal.id === targetPortalId) : null) ??
    args.runtime.portals.find((portal) => portal.entryCue === "suggested") ??
    args.runtime.portals.find((portal) => portal.availability === "available") ??
    args.runtime.portals[0] ??
    null;

  if (!targetPortal) {
    return {
      status: "resting",
      source: "resolved-runtime",
      eyebrow: "길 안내",
      title: "지금은 활성 길 안내가 없어요",
      detail: "다음 미션 경로가 열릴 때까지 홈 공간은 단정하게 유지돼요.",
      chipLabel: "길 안내 휴식",
      ambientLabel: "길 안내 대기",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
      homePosition: args.runtime.spawn.position,
      targetPosition: null,
      trailProgress: [],
    };
  }

  const shouldActivate = args.readiness.status === "ready";
  const shouldSuggest = args.suggestion.status === "suggested" || args.readiness.status === "warming";
  const inHomeLane = args.homeZoneState === "arrived" || args.homeZoneState === "approaching";
  const status: WorldHubJourneyPathGuidance["status"] = shouldActivate ? "active" : shouldSuggest ? "suggested" : "resting";
  const trailProgress = status === "resting" ? [] : resolveTrailProgress(targetPortal.id);

  return {
    status,
    source: "resolved-runtime",
    eyebrow: "길 안내",
    title:
      status === "active"
        ? `${targetPortal.label} 방향 길이 부드럽게 밝혀졌어요`
        : status === "suggested"
          ? `홈에서 ${targetPortal.label} 방향을 은은하게 안내하고 있어요`
          : "길 안내가 쉬고 있어요",
    detail:
      status === "active"
        ? inHomeLane
          ? "작은 길빛이 홈 공간에서 다음 포털까지 자연스럽게 이어져요."
          : "홈으로 돌아올 때마다 잔잔한 길빛이 방향을 유지해요."
        : status === "suggested"
          ? "홈 주변의 낮은 강도 신호가 부담 없이 다음 방향을 알려줘요."
          : "경로 신호를 띄우지 않아 베이스캠프는 홈 중심의 분위기를 유지해요.",
    chipLabel:
      status === "active"
        ? `길 밝힘 · ${targetPortal.label}`
        : status === "suggested"
          ? `길 제안 · ${targetPortal.label}`
          : "길 안내 휴식",
    ambientLabel:
      status === "active" ? "길빛 활성" : status === "suggested" ? "길빛 제안" : "길빛 대기",
    accent: status === "resting" ? "#94a3b8" : targetPortal.accent,
    targetPortalId: targetPortal.id,
    targetPortalLabel: targetPortal.label,
    homePosition: args.runtime.spawn.position,
    targetPosition: targetPortal.position,
    trailProgress,
  };
}
