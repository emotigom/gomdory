import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";
import type { WorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import type { WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";

export type WorldHubNextAdventureReadinessCue = {
  status: "ready" | "warming" | "resting";
  source: "deterministic-fallback" | "resolved-runtime";
  eyebrow: string;
  title: string;
  detail: string;
  chipLabel: string;
  markerLabel: string;
  accent: string;
  targetPortalId: string | null;
  targetPortalLabel: string | null;
};

function resolveTargetPortal(args: {
  runtime: WorldHubRuntimeInputs;
  suggestion: WorldHubNextAdventureSuggestionCue;
}) {
  if (args.suggestion.targetPortalId) {
    const byId = args.runtime.portals.find((portal) => portal.id === args.suggestion.targetPortalId);
    if (byId) return byId;
  }

  return (
    args.runtime.portals.find((portal) => portal.entryCue === "suggested") ??
    args.runtime.portals.find((portal) => portal.availability === "available") ??
    args.runtime.portals[0] ??
    null
  );
}

export function resolveWorldHubNextAdventureReadinessCue(args: {
  runtime: WorldHubRuntimeInputs | null;
  homeZoneState: WorldHubHomeZoneState;
  recentJourney: WorldHubRecentJourneyView;
  suggestion: WorldHubNextAdventureSuggestionCue;
}): WorldHubNextAdventureReadinessCue {
  if (!args.runtime || args.runtime.portals.length === 0) {
    return {
      status: "warming",
      source: "deterministic-fallback",
      eyebrow: "출발 준비",
      title: "홈 주변에서 출발 준비를 맞추고 있어요",
      detail: "베이스캠프가 다음 경로를 정리 중이에요. 길이 정해지면 작은 신호가 나타나요.",
      chipLabel: "출발 준비 신호 준비 중",
      markerLabel: "준비 중",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
    };
  }

  const targetPortal = resolveTargetPortal({ runtime: args.runtime, suggestion: args.suggestion });
  if (!targetPortal) {
    return {
      status: "resting",
      source: "resolved-runtime",
      eyebrow: "출발 준비",
      title: "지금은 활성 출발 연결이 없어요",
      detail: "다음 미션 연결 신호가 나타날 때까지 홈 공간은 차분히 유지돼요.",
      chipLabel: "출발 준비 휴식",
      markerLabel: "차분한 대기",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
    };
  }

  const hasJourneyMomentum = args.recentJourney.status === "ready" || args.suggestion.status === "suggested";
  const inHomeLane = args.homeZoneState === "arrived" || args.homeZoneState === "approaching";

  if (targetPortal.availability === "available" && hasJourneyMomentum) {
    return {
      status: "ready",
      source: "resolved-runtime",
      eyebrow: "출발 준비",
      title: `${targetPortal.label} 출발 준비가 됐어요`,
      detail: inHomeLane
        ? "홈 표식과 최근 여정이 맞춰졌어요. 준비되면 편하게 출발하세요."
        : "홈 공간의 부드러운 신호가 켜져 있어 돌아왔다가 자연스럽게 출발할 수 있어요.",
      chipLabel: `출발 준비 완료 · ${targetPortal.label}`,
      markerLabel: "출발 가능",
      accent: targetPortal.accent,
      targetPortalId: targetPortal.id,
      targetPortalLabel: targetPortal.label,
    };
  }

  if (targetPortal.availability === "queued" || targetPortal.entryCue === "suggested") {
    return {
      status: "warming",
      source: "resolved-runtime",
      eyebrow: "출발 준비",
      title: `${targetPortal.label} 출발 준비 중이에요`,
      detail: "홈 근처에서 최근 여정을 살펴보고, 게이트가 열리면 길 안내를 따라가 보세요.",
      chipLabel: `준비 중 · ${targetPortal.label}`,
      markerLabel: "길 준비 중",
      accent: "#34d399",
      targetPortalId: targetPortal.id,
      targetPortalLabel: targetPortal.label,
    };
  }

  return {
    status: "resting",
    source: "resolved-runtime",
    eyebrow: "출발 준비",
    title: `${targetPortal.label} 포털은 잠시 뒤 열려요`,
    detail: "지금은 다음 제안이 잠시 쉬는 중이에요. 새 경로가 열릴 때까지 홈 신호를 은은하게 유지해요.",
    chipLabel: `대기 · ${targetPortal.label}`,
    markerLabel: "대기",
    accent: "#94a3b8",
    targetPortalId: targetPortal.id,
    targetPortalLabel: targetPortal.label,
  };
}
