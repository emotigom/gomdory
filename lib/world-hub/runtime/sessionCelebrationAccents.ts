import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

export type WorldHubSessionCelebrationAccentPlacement = "central-plaza" | "academy-lodge";
export type WorldHubSessionCelebrationAccentKind = "hearth-glow" | "lodge-lanterns";
export type WorldHubSessionCelebrationAccentTone = "quiet" | "soft" | "warm";

export type WorldHubSessionCelebrationAccent = {
  id: string;
  placement: WorldHubSessionCelebrationAccentPlacement;
  kind: WorldHubSessionCelebrationAccentKind;
  label: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubSessionCelebrationAccentTone;
  active: boolean;
};

export type WorldHubSessionCelebrationSummary = {
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

export function resolveWorldHubSessionCelebrationAccents(args: {
  runtime: WorldHubRuntimeInputs | null;
  recentMissionResult: WorldHubMissionResultReturnEnvelope | null;
  now?: Date;
}): {
  accents: WorldHubSessionCelebrationAccent[];
  summary: WorldHubSessionCelebrationSummary | null;
} {
  if (!args.runtime) {
    return { accents: [], summary: null };
  }

  const completion = resolveRecentCompletion({
    runtime: args.runtime,
    recentMissionResult: args.recentMissionResult,
  });
  if (!completion) {
    return { accents: [], summary: null };
  }

  const nowMs = (args.now ?? new Date()).getTime();
  const completionAgeMs = Math.max(0, nowMs - new Date(completion.completedAtIso).getTime());
  const participantCount = Math.max(1, args.runtime.session.occupancy || args.runtime.presence.nearbyPeers.length + 1);
  const hasSharedSession = participantCount >= 2;

  if (!hasSharedSession) {
    return { accents: [], summary: null };
  }

  const activeWindowMs = 1000 * 60 * 18;
  const softWindowMs = 1000 * 60 * 40;
  const withinActiveWindow = completionAgeMs <= activeWindowMs;
  const withinSoftWindow = completionAgeMs <= softWindowMs;

  if (!withinSoftWindow) {
    return { accents: [], summary: null };
  }

  const baseTone: WorldHubSessionCelebrationAccentTone = withinActiveWindow ? "warm" : "soft";
  const plazaTone: WorldHubSessionCelebrationAccentTone =
    args.runtime.liveSession.cueState === "gather_at_plaza" ? "warm" : baseTone;
  const academyTone: WorldHubSessionCelebrationAccentTone =
    args.runtime.liveSession.cueState === "prepare_at_academy" || args.runtime.liveSession.cueState === "start_mission"
      ? "warm"
      : baseTone;

  const accents: WorldHubSessionCelebrationAccent[] = [
    {
      id: "session-accent:plaza-hearth",
      placement: "central-plaza",
      kind: "hearth-glow",
      label: withinActiveWindow ? "Shared glow" : "Settling glow",
      position: {
        x: args.runtime.spawn.position.x + 2.2,
        y: args.runtime.spawn.position.y - 2.6,
      },
      accent: "#fbbf24",
      tone: plazaTone,
      active: withinActiveWindow,
    },
    {
      id: "session-accent:academy-lanterns",
      placement: "academy-lodge",
      kind: "lodge-lanterns",
      label: withinActiveWindow ? "Lodge lights" : "Lodge afterglow",
      position: {
        x: args.runtime.kiosk.position.x + 1.1,
        y: args.runtime.kiosk.position.y + 8.1,
      },
      accent: "#67e8f9",
      tone: academyTone,
      active: withinActiveWindow,
    },
  ];

  return {
    accents,
    summary: {
      eyebrow: "Shared space",
      title: withinActiveWindow ? "Plaza and lodge are softly celebrating" : "A recent class moment is settling",
      detail: `${participantCount} learners recently completed ${completion.missionTitle}.`,
      chips: [completion.completionLabel, withinActiveWindow ? "Short-lived shared accents" : "Fading shared accents"],
    },
  };
}
