import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

import type { WorldHubJourneyPathGuidance } from "@/lib/world-hub/runtime/journeyPathGuidance";
import type { WorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";

export type WorldHubPortalRidgeAnticipationCueTone = "quiet" | "soft" | "warm";
export type WorldHubPortalRidgeAnticipationCueKind = "launch-availability" | "mission-readiness" | "nearby-expectation";

export type WorldHubPortalRidgeAnticipationCue = {
  id: string;
  portalId: string;
  kind: WorldHubPortalRidgeAnticipationCueKind;
  label: string;
  detail: string;
  tone: WorldHubPortalRidgeAnticipationCueTone;
  active: boolean;
  accent: string;
  position: WorldHubPoint;
};

export type WorldHubPortalRidgeAnticipationSummary = {
  eyebrow: string;
  title: string;
  detail: string;
  chips: string[];
};

function resolveCueTone(args: {
  kind: WorldHubPortalRidgeAnticipationCueKind;
  active: boolean;
  liveSession: WorldHubRuntimeInputs["liveSession"];
}): WorldHubPortalRidgeAnticipationCueTone {
  if (!args.active) return "quiet";
  if (args.liveSession.cueState === "start_mission") return "warm";
  return args.kind === "nearby-expectation" ? "soft" : "warm";
}

export function resolveWorldHubPortalRidgeAnticipationCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  homeReadinessCue: WorldHubNextAdventureReadinessCue;
  journeyPathGuidance: WorldHubJourneyPathGuidance;
}): {
  cues: WorldHubPortalRidgeAnticipationCue[];
  summary: WorldHubPortalRidgeAnticipationSummary | null;
} {
  if (!args.runtime) {
    return {
      cues: [],
      summary: null,
    };
  }

  const targetPortalId =
    args.journeyPathGuidance.targetPortalId ??
    args.homeReadinessCue.targetPortalId ??
    args.runtime.portals.find((portal) => portal.entryCue === "suggested")?.id ??
    args.runtime.portals.find((portal) => portal.availability === "available")?.id ??
    null;
  const targetPortal = targetPortalId ? args.runtime.portals.find((portal) => portal.id === targetPortalId) ?? null : null;
  if (!targetPortal) {
    return {
      cues: [],
      summary: {
        eyebrow: "포털 언덕",
        title: "언덕 신호가 쉬고 있어요",
        detail: "가까운 출발 신호가 아직 정해지지 않아 언덕은 차분하게 유지돼요.",
        chips: ["기본 경로", "활성 길 없음"],
      },
    };
  }

  const launchOpen = targetPortal.entryCue !== "unavailable";
  const readinessReady = args.homeReadinessCue.status === "ready" && args.homeReadinessCue.targetPortalId === targetPortal.id;
  const nearbyExpected =
    args.journeyPathGuidance.status === "active" || args.journeyPathGuidance.status === "suggested";
  const expectationActive = nearbyExpected && args.journeyPathGuidance.targetPortalId === targetPortal.id;
  const expectationChip =
    args.journeyPathGuidance.status === "active"
      ? "길 기대 신호 활성"
      : args.journeyPathGuidance.status === "suggested"
        ? "길 기대 신호 준비"
        : "길 기대 신호 휴식";

  const cues: WorldHubPortalRidgeAnticipationCue[] = [
    {
      id: `${targetPortal.id}:launch-availability`,
      portalId: targetPortal.id,
      kind: "launch-availability",
      label: launchOpen ? "게이트 불빛이 열려 있어요" : "게이트 불빛이 잦아들고 있어요",
      detail: launchOpen ? targetPortal.statusLabel : "지금은 다른 출발 지점에 집중하고 있어요.",
      active: launchOpen,
      tone: resolveCueTone({
        kind: "launch-availability",
        active: launchOpen,
        liveSession: args.runtime.liveSession,
      }),
      accent: launchOpen ? targetPortal.accent : "#64748b",
      position: {
        x: targetPortal.position.x,
        y: targetPortal.position.y + 4.3,
      },
    },
    {
      id: `${targetPortal.id}:mission-readiness`,
      portalId: targetPortal.id,
      kind: "mission-readiness",
      label: readinessReady ? "미션 준비가 안정됐어요" : "미션 준비가 올라오고 있어요",
      detail: readinessReady ? args.homeReadinessCue.chipLabel : "홈 공간에서 가장 안정적인 출발 타이밍을 안내하고 있어요.",
      active: readinessReady,
      tone: resolveCueTone({
        kind: "mission-readiness",
        active: readinessReady,
        liveSession: args.runtime.liveSession,
      }),
      accent: readinessReady ? "#22d3ee" : "#64748b",
      position: {
        x: targetPortal.position.x - 1.2,
        y: targetPortal.position.y + 7.1,
      },
    },
    {
      id: `${targetPortal.id}:nearby-expectation`,
      portalId: targetPortal.id,
      kind: "nearby-expectation",
      label: expectationActive ? "근처 길 기대 신호가 켜졌어요" : "근처 길 기대 신호가 잔잔해요",
      detail: expectationActive
        ? args.journeyPathGuidance.detail
        : "근처 모험 의도가 보이도록 작은 언덕 신호를 유지해요.",
      active: expectationActive,
      tone: resolveCueTone({
        kind: "nearby-expectation",
        active: expectationActive,
        liveSession: args.runtime.liveSession,
      }),
      accent: expectationActive ? "#fbbf24" : "#94a3b8",
      position: {
        x: targetPortal.position.x + 1.3,
        y: targetPortal.position.y + 7.2,
      },
    },
  ];

  return {
    cues,
    summary: {
      eyebrow: "포털 언덕",
      title: launchOpen ? `${targetPortal.label} 출발 준비가 맞춰졌어요` : `${targetPortal.label} 출발 신호가 조용히 대기 중이에요`,
      detail: "출발 가능 상태와 준비도, 근처 기대 신호를 가벼운 언덕 안내로 보여줘요.",
      chips: [
        launchOpen ? "출발 가능" : "출발 대기",
        readinessReady ? "미션 준비 완료" : "미션 준비 중",
        expectationChip,
      ],
    },
  };
}
