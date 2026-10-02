import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

export type WorldHubPortalExitReturnSoftnessPlacement = "portal-threshold" | "home-lane-approach";
export type WorldHubPortalExitReturnSoftnessKind = "arrival-ring" | "settle-lantern";
export type WorldHubPortalExitReturnSoftnessTone = "quiet" | "soft" | "warm";

export type WorldHubPortalExitReturnSoftnessCue = {
  id: string;
  placement: WorldHubPortalExitReturnSoftnessPlacement;
  kind: WorldHubPortalExitReturnSoftnessKind;
  label: string;
  detail: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubPortalExitReturnSoftnessTone;
  active: boolean;
};

export type WorldHubPortalExitReturnSoftnessSummary = {
  eyebrow: string;
  title: string;
  detail: string;
  chips: string[];
};

export function resolveWorldHubPortalExitReturnSoftnessCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): {
  cues: WorldHubPortalExitReturnSoftnessCue[];
  summary: WorldHubPortalExitReturnSoftnessSummary | null;
} {
  if (!args.runtime || !args.recentMissionResult) {
    return { cues: [], summary: null };
  }

  const cueState = args.runtime.liveSession.cueState;
  if (cueState === "start_mission") {
    return { cues: [], summary: null };
  }

  const nowMs = (args.now ?? new Date()).getTime();
  const completionAgeMs = Math.max(0, nowMs - new Date(args.recentMissionResult.payload.completedAtIso).getTime());
  const activeWindowMs = 1000 * 45;
  const fadeWindowMs = 1000 * 60 * 4;

  if (completionAgeMs > fadeWindowMs) {
    return { cues: [], summary: null };
  }

  const withinActiveWindow = completionAgeMs <= activeWindowMs;
  const tone: WorldHubPortalExitReturnSoftnessTone = withinActiveWindow ? "soft" : "quiet";
  const missionTitle = args.recentMissionResult.payload.missionTitle;

  const cues: WorldHubPortalExitReturnSoftnessCue[] = [
    {
      id: "portal-exit-return-softness:threshold",
      placement: "portal-threshold",
      kind: "arrival-ring",
      label: withinActiveWindow ? "다시 돌아왔어요" : "돌아온 불빛이 잦아들어요",
      detail: `${missionTitle}에서 홈으로 돌아왔어요.`,
      position: {
        x: args.runtime.spawn.position.x + 4.8,
        y: args.runtime.spawn.position.y - 2.2,
      },
      accent: "#86efac",
      tone,
      active: withinActiveWindow,
    },
    {
      id: "portal-exit-return-softness:home-lane",
      placement: "home-lane-approach",
      kind: "settle-lantern",
      label: "베이스캠프로 복귀했어요",
      detail: "잠깐 숨을 고르고 홈 공간으로 이동해 보세요.",
      position: {
        x: args.runtime.spawn.position.x + 1.5,
        y: args.runtime.spawn.position.y + 5.7,
      },
      accent: "#fcd34d",
      tone,
      active: withinActiveWindow,
    },
  ];

  return {
    cues,
    summary: {
      eyebrow: "포털 복귀",
      title: withinActiveWindow ? "베이스캠프에 부드럽게 착지했어요" : "복귀 신호가 서서히 사라지고 있어요",
      detail: `${missionTitle} 복귀가 정리되었어요. 이제 홈 안정 신호가 우선으로 안내돼요.`,
      chips: [
        args.recentMissionResult.payload.summary.completionLabel,
        withinActiveWindow ? "복귀 착지 활성" : "복귀 착지 페이드",
      ],
    },
  };
}
