import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

export type WorldHubPlazaSessionWrapUpCuePlacement = "plaza-ring-north" | "plaza-bench-east";
export type WorldHubPlazaSessionWrapUpCueKind = "afterglow-ring" | "lantern-note";
export type WorldHubPlazaSessionWrapUpCueTone = "quiet" | "soft" | "warm";

export type WorldHubPlazaSessionWrapUpCue = {
  id: string;
  placement: WorldHubPlazaSessionWrapUpCuePlacement;
  kind: WorldHubPlazaSessionWrapUpCueKind;
  label: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubPlazaSessionWrapUpCueTone;
  active: boolean;
};

export type WorldHubPlazaSessionWrapUpSummary = {
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

export function resolveWorldHubPlazaSessionWrapUpCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): {
  cues: WorldHubPlazaSessionWrapUpCue[];
  summary: WorldHubPlazaSessionWrapUpSummary | null;
} {
  if (!args.runtime) return { cues: [], summary: null };

  const participantCount = Math.max(1, args.runtime.session.occupancy || args.runtime.presence.nearbyPeers.length + 1);
  if (participantCount < 2) return { cues: [], summary: null };

  const completion = resolveRecentCompletion({
    runtime: args.runtime,
    recentMissionResult: args.recentMissionResult,
  });
  if (!completion) return { cues: [], summary: null };

  const cueState = args.runtime.liveSession.cueState;
  const liveStatus = args.runtime.liveSession.status;
  const wrappedState = cueState === "none" && liveStatus === "self-paced-open";
  if (!wrappedState) return { cues: [], summary: null };

  const nowMs = (args.now ?? new Date()).getTime();
  const completionAgeMs = Math.max(0, nowMs - new Date(completion.completedAtIso).getTime());
  const activeWindowMs = 1000 * 60 * 9;
  const fadeWindowMs = 1000 * 60 * 28;
  const withinActiveWindow = completionAgeMs <= activeWindowMs;
  const withinFadeWindow = completionAgeMs <= fadeWindowMs;
  if (!withinFadeWindow) return { cues: [], summary: null };

  const tone: WorldHubPlazaSessionWrapUpCueTone = withinActiveWindow ? "soft" : "quiet";
  const cues: WorldHubPlazaSessionWrapUpCue[] = [
    {
      id: "plaza-wrap-up:ring",
      placement: "plaza-ring-north",
      kind: "afterglow-ring",
      label: withinActiveWindow ? "Session wrapped" : "After class calm",
      position: {
        x: args.runtime.spawn.position.x - 2.1,
        y: args.runtime.spawn.position.y - 4.4,
      },
      accent: "#86efac",
      tone,
      active: withinActiveWindow,
    },
    {
      id: "plaza-wrap-up:lantern-note",
      placement: "plaza-bench-east",
      kind: "lantern-note",
      label: "Great teamwork today",
      position: {
        x: args.runtime.spawn.position.x + 4.2,
        y: args.runtime.spawn.position.y - 1.6,
      },
      accent: "#fcd34d",
      tone,
      active: withinActiveWindow,
    },
  ];

  return {
    cues,
    summary: {
      eyebrow: "Plaza wrap-up",
      title: withinActiveWindow ? "Today’s class session has wrapped" : "Plaza afterglow is settling",
      detail: `${participantCount} learners just completed ${completion.missionTitle}.`,
      chips: [completion.completionLabel, withinActiveWindow ? "Brief shared cue" : "Fading shared cue"],
    },
  };
}
