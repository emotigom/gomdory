import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubJourneyPathGuidance } from "@/lib/world-hub/runtime/journeyPathGuidance";
import type { WorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";

export type WorldHubAcademyPortalTempoCuePlacement =
  | "academy-threshold"
  | "ridge-mid-lane"
  | "portal-threshold";
export type WorldHubAcademyPortalTempoCueKind = "lantern-tempo" | "trail-tempo" | "departure-soft-chime";
export type WorldHubAcademyPortalTempoCueTone = "quiet" | "soft" | "warm";

export type WorldHubAcademyPortalTempoCue = {
  id: string;
  placement: WorldHubAcademyPortalTempoCuePlacement;
  kind: WorldHubAcademyPortalTempoCueKind;
  label: string;
  detail: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubAcademyPortalTempoCueTone;
  active: boolean;
  targetPortalId: string;
};

export type WorldHubAcademyPortalTempoSummary = {
  eyebrow: string;
  title: string;
  detail: string;
  chips: string[];
};

function resolveTargetPortal(args: {
  runtime: WorldHubRuntimeInputs;
  journeyPathGuidance: WorldHubJourneyPathGuidance;
  homeReadinessCue: WorldHubNextAdventureReadinessCue;
}) {
  const byId =
    args.journeyPathGuidance.targetPortalId ??
    args.homeReadinessCue.targetPortalId ??
    args.runtime.portals.find((portal) => portal.entryCue === "suggested")?.id ??
    args.runtime.portals.find((portal) => portal.availability === "available")?.id ??
    null;
  return byId ? args.runtime.portals.find((portal) => portal.id === byId) ?? null : null;
}

function midpoint(a: WorldHubPoint, b: WorldHubPoint): WorldHubPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function resolveWorldHubAcademyPortalTempoCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  journeyPathGuidance: WorldHubJourneyPathGuidance;
  homeReadinessCue: WorldHubNextAdventureReadinessCue;
}): {
  cues: WorldHubAcademyPortalTempoCue[];
  summary: WorldHubAcademyPortalTempoSummary | null;
} {
  if (!args.runtime) return { cues: [], summary: null };

  const targetPortal = resolveTargetPortal({
    runtime: args.runtime,
    journeyPathGuidance: args.journeyPathGuidance,
    homeReadinessCue: args.homeReadinessCue,
  });
  if (!targetPortal) {
    return {
      cues: [],
      summary: {
        eyebrow: "출발 템포",
        title: "아카데미 출발 템포가 쉬고 있어요",
        detail: "다음 출발 경로가 아직 정해지지 않아 아카데미 길 안내가 조용히 유지돼요.",
        chips: ["템포 휴식", "경로 대상 없음"],
      },
    };
  }

  const cueState = args.runtime.liveSession.cueState;
  const supportsTempo =
    cueState === "prepare_at_academy" ||
    (cueState === "start_mission" && args.journeyPathGuidance.status !== "resting");
  if (!supportsTempo) {
    return { cues: [], summary: null };
  }

  const active = cueState === "prepare_at_academy";
  const tone: WorldHubAcademyPortalTempoCueTone = active ? "warm" : "soft";
  const academyThreshold = {
    x: args.runtime.kiosk.position.x + 1.5,
    y: args.runtime.kiosk.position.y + 8.3,
  };
  const ridgeMidLane = midpoint(academyThreshold, targetPortal.position);
  const portalThreshold = {
    x: targetPortal.position.x - 0.8,
    y: targetPortal.position.y + 4.9,
  };

  const cues: WorldHubAcademyPortalTempoCue[] = [
    {
      id: `${targetPortal.id}:academy-threshold-tempo`,
      placement: "academy-threshold",
      kind: "lantern-tempo",
      label: active ? "준비 리듬이 안정됐어요" : "준비 리듬이 잦아들고 있어요",
      detail: active
        ? "아카데미 입구 신호가 팀의 준비 상태를 차분히 알려줘요."
        : "아카데미 준비가 끝나고, 출발 신호가 더 부드럽게 이어져요.",
      position: academyThreshold,
      accent: "#a78bfa",
      tone,
      active,
      targetPortalId: targetPortal.id,
    },
    {
      id: `${targetPortal.id}:ridge-mid-tempo`,
      placement: "ridge-mid-lane",
      kind: "trail-tempo",
      label: active ? "출발 길이 리듬을 타고 있어요" : "출발 길이 부드럽게 이어져요",
      detail: active
        ? "중간 길의 잔잔한 펄스가 아카데미에서 언덕까지의 흐름을 안정적으로 이어줘요."
        : "눈에 부담 없는 단일 신호로 방향만 또렷하게 보여줘요.",
      position: ridgeMidLane,
      accent: targetPortal.accent,
      tone: active ? "soft" : "quiet",
      active,
      targetPortalId: targetPortal.id,
    },
    {
      id: `${targetPortal.id}:portal-threshold-tempo`,
      placement: "portal-threshold",
      kind: "departure-soft-chime",
      label: active ? "출발 신호가 부드럽게 기다려요" : "출발 신호가 옅게 남아 있어요",
      detail: active
        ? `${targetPortal.label} 포털 앞에 은은한 신호를 두어 출발 흐름을 자연스럽게 만들어요.`
        : `${targetPortal.label} 포털 신호를 낮춰 기대감의 리듬을 지켜요.`,
      position: portalThreshold,
      accent: "#22d3ee",
      tone: active ? "soft" : "quiet",
      active,
      targetPortalId: targetPortal.id,
    },
  ];

  return {
    cues,
    summary: {
      eyebrow: "출발 템포",
      title: active ? "아카데미에서 포털로 이어지는 템포가 활성화됐어요" : "출발 템포가 차분히 잦아들고 있어요",
      detail: `아카데미 준비 흐름이 ${targetPortal.label} 방향의 부드러운 출발 리듬으로 이어지고 있어요.`,
      chips: [
        active ? "준비→출발 활성" : "준비→출발 잔잔",
        args.journeyPathGuidance.status === "active" ? "길 안내 활성" : "길 안내 제안",
      ],
    },
  };
}
