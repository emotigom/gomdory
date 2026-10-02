import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

export type WorldHubEndOfDayQuietStateCuePlacement = "home-hearth" | "academy-porch" | "plaza-path";
export type WorldHubEndOfDayQuietStateCueKind = "hearth-embers" | "porch-lantern-glow" | "pathway-rest-lights";
export type WorldHubEndOfDayQuietStateCueTone = "quiet" | "soft";

export type WorldHubEndOfDayQuietStateCue = {
  id: string;
  placement: WorldHubEndOfDayQuietStateCuePlacement;
  kind: WorldHubEndOfDayQuietStateCueKind;
  label: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubEndOfDayQuietStateCueTone;
  active: boolean;
};

export type WorldHubEndOfDayQuietStateSummary = {
  eyebrow: string;
  title: string;
  detail: string;
  chips: string[];
};

function resolveRecentCompletion(args: {
  runtime: WorldHubRuntimeInputs;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
}) {
  if (args.recentMissionResult?.payload) {
    return {
      missionTitle: args.recentMissionResult.payload.missionTitle,
      completedAtIso: args.recentMissionResult.payload.completedAtIso,
      completionLabel: args.recentMissionResult.payload.summary.completionLabel,
    };
  }

  const progressCompletion = args.runtime.progress.recentMissionCompletion;
  if (!progressCompletion) return null;

  return {
    missionTitle: progressCompletion.missionTitle,
    completedAtIso: progressCompletion.completedAtIso,
    completionLabel: progressCompletion.completionLabel,
  };
}

function hasActiveGuidedClass(runtime: WorldHubRuntimeInputs) {
  return (
    runtime.liveSession.status === "teacher-guided" ||
    runtime.liveSession.status === "mission-starting-soon" ||
    runtime.liveSession.cueState === "gather_at_plaza" ||
    runtime.liveSession.cueState === "prepare_at_academy" ||
    runtime.liveSession.cueState === "start_mission"
  );
}

export function resolveWorldHubEndOfDayQuietStateCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): {
  cues: WorldHubEndOfDayQuietStateCue[];
  summary: WorldHubEndOfDayQuietStateSummary | null;
} {
  if (!args.runtime) return { cues: [], summary: null };

  if (hasActiveGuidedClass(args.runtime)) return { cues: [], summary: null };

  const completion = resolveRecentCompletion({
    runtime: args.runtime,
    recentMissionResult: args.recentMissionResult,
  });
  if (!completion) return { cues: [], summary: null };

  const nowMs = (args.now ?? new Date()).getTime();
  const completionAgeMs = Math.max(0, nowMs - new Date(completion.completedAtIso).getTime());
  const quietStartMs = 1000 * 60 * 22;
  const quietEndMs = 1000 * 60 * 60 * 8;
  const withinQuietWindow = completionAgeMs >= quietStartMs && completionAgeMs <= quietEndMs;
  if (!withinQuietWindow) return { cues: [], summary: null };

  const stillWarmWindowMs = 1000 * 60 * 90;
  const tone: WorldHubEndOfDayQuietStateCueTone = completionAgeMs <= stillWarmWindowMs ? "soft" : "quiet";
  const gentlyActive = tone === "soft";

  const cues: WorldHubEndOfDayQuietStateCue[] = [
    {
      id: "end-of-day:home-hearth",
      placement: "home-hearth",
      kind: "hearth-embers",
      label: tone === "soft" ? "Hearth settling" : "Hearth is settled",
      position: {
        x: args.runtime.spawn.position.x + 0.8,
        y: args.runtime.spawn.position.y - 2,
      },
      accent: "#f59e0b",
      tone,
      active: gentlyActive,
    },
    {
      id: "end-of-day:academy-porch",
      placement: "academy-porch",
      kind: "porch-lantern-glow",
      label: tone === "soft" ? "Porch lights warm" : "Porch lights at rest",
      position: {
        x: args.runtime.kiosk.position.x + 1.4,
        y: args.runtime.kiosk.position.y + 6.8,
      },
      accent: "#67e8f9",
      tone,
      active: gentlyActive,
    },
    {
      id: "end-of-day:plaza-path",
      placement: "plaza-path",
      kind: "pathway-rest-lights",
      label: "Paths feel complete",
      position: {
        x: args.runtime.spawn.position.x + 4.8,
        y: args.runtime.spawn.position.y - 0.8,
      },
      accent: "#86efac",
      tone,
      active: gentlyActive,
    },
  ];

  return {
    cues,
    summary: {
      eyebrow: "Quiet state",
      title: tone === "soft" ? "Basecamp is easing into end-of-day calm" : "Basecamp is in a settled quiet state",
      detail: `After ${completion.missionTitle}, the hub stays warm and revisit-ready without additional prompts.`,
      chips: [completion.completionLabel, tone === "soft" ? "Gentle settle window" : "Steady quiet layer"],
    },
  };
}
