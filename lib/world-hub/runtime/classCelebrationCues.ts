import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

export type WorldHubClassCelebrationCueKind = "pulse-ring" | "academy-ribbon";
export type WorldHubClassCelebrationCueTone = "quiet" | "soft" | "warm";
export type WorldHubClassCelebrationCuePlacement = "plaza-campfire" | "academy-approach";

export type WorldHubClassCelebrationCue = {
  id: string;
  label: string;
  placement: WorldHubClassCelebrationCuePlacement;
  kind: WorldHubClassCelebrationCueKind;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubClassCelebrationCueTone;
  active: boolean;
};

export type WorldHubClassCelebrationSummary = {
  eyebrow: string;
  title: string;
  detail: string;
  chips: string[];
};

export function resolveWorldHubClassCelebrationCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  launchClassId: string | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): {
  cues: WorldHubClassCelebrationCue[];
  summary: WorldHubClassCelebrationSummary | null;
} {
  if (!args.runtime || !args.launchClassId) {
    return {
      cues: [],
      summary: null,
    };
  }

  const nowMs = (args.now ?? new Date()).getTime();
  const progressCompletion = args.runtime.progress.recentMissionCompletion;
  const missionCompletion = args.recentMissionResult?.payload
    ? {
        missionTitle: args.recentMissionResult.payload.missionTitle,
        completedAtIso: args.recentMissionResult.payload.completedAtIso,
        completionLabel: args.recentMissionResult.payload.summary.completionLabel,
      }
    : progressCompletion
      ? {
          missionTitle: progressCompletion.missionTitle,
          completedAtIso: progressCompletion.completedAtIso,
          completionLabel: progressCompletion.completionLabel,
        }
      : null;

  const completionAgeMs = missionCompletion ? Math.max(0, nowMs - new Date(missionCompletion.completedAtIso).getTime()) : null;
  const recentSharedCompletion = completionAgeMs !== null && completionAgeMs <= 1000 * 60 * 45;
  const participantCount = Math.max(1, args.runtime.session.occupancy || args.runtime.presence.nearbyPeers.length + 1);
  const warmTone: WorldHubClassCelebrationCueTone = recentSharedCompletion ? "warm" : "soft";

  const cues: WorldHubClassCelebrationCue[] = [
    {
      id: `${args.launchClassId}:plaza`,
      label: recentSharedCompletion ? "Class cheer" : "Class pulse",
      placement: "plaza-campfire",
      kind: "pulse-ring",
      position: {
        x: args.runtime.spawn.position.x + 2.6,
        y: args.runtime.spawn.position.y - 3.2,
      },
      accent: "#f59e0b",
      tone: warmTone,
      active: recentSharedCompletion,
    },
    {
      id: `${args.launchClassId}:academy`,
      label: recentSharedCompletion ? "Shared win ribbon" : "Class ribbon",
      placement: "academy-approach",
      kind: "academy-ribbon",
      position: {
        x: args.runtime.kiosk.position.x + 1.4,
        y: args.runtime.kiosk.position.y + 7.4,
      },
      accent: "#a78bfa",
      tone:
        args.runtime.liveSession.cueState === "prepare_at_academy" || args.runtime.liveSession.cueState === "start_mission"
          ? "warm"
          : warmTone,
      active: recentSharedCompletion,
    },
  ];

  const summary: WorldHubClassCelebrationSummary = {
    eyebrow: "Class moment",
    title: recentSharedCompletion ? "A shared win is glowing" : "Your class lane is active",
    detail: recentSharedCompletion
      ? `${participantCount} classmates recently completed ${missionCompletion?.missionTitle ?? "today's mission"}.`
      : `${participantCount} classmates are active in this class-scoped basecamp lane.`,
    chips: [
      `${participantCount} learners active`,
      missionCompletion && recentSharedCompletion ? missionCompletion.completionLabel : "Home-first cues stay lightweight",
    ],
  };

  return {
    cues,
    summary,
  };
}
