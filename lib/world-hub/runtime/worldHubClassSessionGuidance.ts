import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

export type WorldHubClassSessionGuidanceStage = "gather" | "prepare" | "launch";

export type WorldHubClassSessionGuidanceCard = {
  visible: boolean;
  stage: WorldHubClassSessionGuidanceStage;
  prominence: "primary" | "secondary" | "subtle";
  eyebrow: string;
  title: string;
  body: string;
  hint: string;
  chipLabel: string;
};

export function resolveWorldHubClassSessionGuidanceCard(args: {
  liveSession: WorldHubRuntimeInputs["liveSession"] | null;
  hasFocusedPortal: boolean;
  hasSelectedPortal: boolean;
  kioskFocused: boolean;
}): WorldHubClassSessionGuidanceCard | null {
  const cue = args.liveSession;
  if (!cue) return null;

  if (cue.status === "teacher-guided" && cue.cueState === "gather_at_plaza") {
    return {
      visible: true,
      stage: "gather",
      prominence: args.hasFocusedPortal || args.hasSelectedPortal ? "secondary" : "primary",
      eyebrow: "학급 안내",
      title: "지금은 광장에 모일 시간이에요",
      body: "모닥불이 있는 광장으로 가면 우리 반의 다음 흐름을 함께 시작할 수 있어요.",
      hint: "광장 빛을 따라 이동하세요",
      chipLabel: "광장 모임",
    };
  }

  if (cue.status === "teacher-guided" && cue.cueState === "prepare_at_academy") {
    return {
      visible: true,
      stage: "prepare",
      prominence: args.kioskFocused ? "secondary" : "primary",
      eyebrow: "학급 안내",
      title: "아카데미에서 출발 준비를 하고 있어요",
      body: "우리 반이 아카데미에서 오늘의 모험을 정리하고 있어요.",
      hint: "아카데미 가까이에서 다음 신호를 기다리세요",
      chipLabel: "아카데미 준비",
    };
  }

  if (cue.status === "mission-starting-soon" && cue.cueState === "start_mission") {
    return {
      visible: true,
      stage: "launch",
      prominence: "primary",
      eyebrow: "출발 안내",
      title: "이제 모험을 시작할 수 있어요",
      body: "준비가 끝났다면 포털로 이어가 우리 반과 함께 출발하세요.",
      hint: "포털 앞에서 Enter 또는 E로 이어가기",
      chipLabel: "출발 직전",
    };
  }

  return null;
}
