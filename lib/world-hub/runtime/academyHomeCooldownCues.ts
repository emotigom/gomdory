import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

export type WorldHubAcademyHomeCooldownCuePlacement =
  | "academy-footbridge"
  | "plaza-home-lane"
  | "home-lane-entry";
export type WorldHubAcademyHomeCooldownCueKind = "lantern-breath" | "footstep-trail" | "porch-welcome";
export type WorldHubAcademyHomeCooldownCueTone = "quiet" | "soft";

export type WorldHubAcademyHomeCooldownCue = {
  id: string;
  placement: WorldHubAcademyHomeCooldownCuePlacement;
  kind: WorldHubAcademyHomeCooldownCueKind;
  label: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubAcademyHomeCooldownCueTone;
  active: boolean;
};

export type WorldHubAcademyHomeCooldownSummary = {
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

export function resolveWorldHubAcademyHomeCooldownCues(args: {
  runtime: WorldHubRuntimeInputs | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): {
  cues: WorldHubAcademyHomeCooldownCue[];
  summary: WorldHubAcademyHomeCooldownSummary | null;
} {
  if (!args.runtime) return { cues: [], summary: null };

  const completion = resolveRecentCompletion({
    runtime: args.runtime,
    recentMissionResult: args.recentMissionResult,
  });
  if (!completion) return { cues: [], summary: null };

  const participantCount = Math.max(1, args.runtime.session.occupancy || args.runtime.presence.nearbyPeers.length + 1);
  if (participantCount < 2) return { cues: [], summary: null };

  if (args.runtime.liveSession.status !== "self-paced-open" || args.runtime.liveSession.cueState !== "none") {
    return { cues: [], summary: null };
  }

  const nowMs = (args.now ?? new Date()).getTime();
  const completionAgeMs = Math.max(0, nowMs - new Date(completion.completedAtIso).getTime());
  const warmupDelayMs = 1000 * 60 * 3;
  const activeWindowMs = 1000 * 60 * 18;
  const fadeWindowMs = 1000 * 60 * 34;
  if (completionAgeMs < warmupDelayMs || completionAgeMs > fadeWindowMs) return { cues: [], summary: null };

  const active = completionAgeMs <= activeWindowMs;
  const tone: WorldHubAcademyHomeCooldownCueTone = active ? "soft" : "quiet";
  const academyBridgePoint = {
    x: args.runtime.kiosk.position.x - 1.2,
    y: args.runtime.kiosk.position.y + 3.9,
  };
  const plazaHomeMidpoint = {
    x: args.runtime.spawn.position.x + 2.2,
    y: args.runtime.spawn.position.y - 2.6,
  };
  const homeEntryPoint = {
    x: args.runtime.spawn.position.x - 1.4,
    y: args.runtime.spawn.position.y + 3.2,
  };

  const cues: WorldHubAcademyHomeCooldownCue[] = [
    {
      id: "academy-home-cooldown:academy-bridge",
      placement: "academy-footbridge",
      kind: "lantern-breath",
      label: active ? "Class energy easing" : "Bridge settling",
      position: academyBridgePoint,
      accent: "#a7f3d0",
      tone,
      active,
    },
    {
      id: "academy-home-cooldown:plaza-home-lane",
      placement: "plaza-home-lane",
      kind: "footstep-trail",
      label: active ? "Follow the soft trail home" : "Trail home remains open",
      position: plazaHomeMidpoint,
      accent: "#67e8f9",
      tone,
      active,
    },
    {
      id: "academy-home-cooldown:home-entry",
      placement: "home-lane-entry",
      kind: "porch-welcome",
      label: active ? "Porch is ready for a calm pause" : "Home porch is resting",
      position: homeEntryPoint,
      accent: "#fde68a",
      tone,
      active,
    },
  ];

  return {
    cues,
    summary: {
      eyebrow: "Cooldown lane",
      title: active ? "Academy energy is gently returning home" : "Cooldown lane is fading into home quiet",
      detail: `${participantCount} learners just wrapped ${completion.missionTitle}; basecamp now projects a calm return lane.`,
      chips: [completion.completionLabel, active ? "Warm cooldown window" : "Fading cooldown window"],
    },
  };
}
