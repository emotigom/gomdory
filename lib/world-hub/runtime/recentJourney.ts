import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { MetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import type { WorldHubHomeRepeatVisitCue } from "@/lib/world-hub/runtime/homeRepeatVisitCue";

export type WorldHubRecentJourneyView = {
  status: "empty" | "ready";
  eyebrow: string;
  title: string;
  detail: string;
  missionLabel: string;
  rewardLabel: string;
  continuityLabel: string;
  chips: string[];
};

function resolveMissionLabel(args: {
  identitySummary: MetaverseResolvedIdentitySummary;
  runtime: WorldHubRuntimeInputs | null;
}) {
  const persistedCompletion = args.runtime?.progress.recentMissionCompletion ?? null;
  const missionTitle = args.identitySummary.profile.lastMissionTitle ?? persistedCompletion?.missionTitle ?? null;
  const completionLabel =
    args.identitySummary.profile.completionLabel ??
    (persistedCompletion ? `${persistedCompletion.completionLabel} · ${persistedCompletion.percentComplete}%` : null);

  if (!missionTitle) {
    return "No recent mission logged yet";
  }

  return completionLabel ? `${missionTitle} · ${completionLabel}` : missionTitle;
}

function resolveRewardLabel(identitySummary: MetaverseResolvedIdentitySummary) {
  if (identitySummary.profile.rewardLabel) {
    return identitySummary.profile.rewardLabel;
  }

  if (identitySummary.collectible.highlightedCollectibleLabel) {
    return `${identitySummary.collectible.summaryLabel} · ${identitySummary.collectible.highlightedCollectibleLabel}`;
  }

  return identitySummary.collectible.summaryLabel;
}

export function resolveWorldHubRecentJourneyView(args: {
  runtime: WorldHubRuntimeInputs | null;
  identitySummary: MetaverseResolvedIdentitySummary;
  homeRepeatVisitCue: WorldHubHomeRepeatVisitCue | null;
}): WorldHubRecentJourneyView {
  const hasMission = args.identitySummary.profile.hasCompletedMission;
  const hasReward = args.identitySummary.profile.hasRecentReward || args.identitySummary.collectible.status === "placeholder";

  if (!hasMission && !hasReward) {
    return {
      status: "empty",
      eyebrow: "Recent journey",
      title: "Your camp journal is waiting",
      detail: "After your next mission return, this mini-surface will quietly remember your latest path, reward, and return rhythm.",
      missionLabel: "No recent mission logged yet",
      rewardLabel: "Reward placeholder shelf is ready",
      continuityLabel: args.homeRepeatVisitCue?.chipLabel ?? "Return rhythm starts with your first visit",
      chips: [args.identitySummary.source.label],
    };
  }

  const missionLabel = resolveMissionLabel({
    identitySummary: args.identitySummary,
    runtime: args.runtime,
  });

  const rewardLabel = resolveRewardLabel(args.identitySummary);

  return {
    status: "ready",
    eyebrow: "Recent journey",
    title: args.identitySummary.profile.lastMissionTitle
      ? `${args.identitySummary.profile.lastMissionTitle} is part of your path`
      : "Your latest path is saved",
    detail: "A compact profile-facing summary of your latest mission completion, reward projection, and gentle return continuity.",
    missionLabel,
    rewardLabel,
    continuityLabel:
      args.homeRepeatVisitCue?.chipLabel ??
      args.runtime?.progress.persistedCompletion?.label ??
      args.identitySummary.profile.persistenceLabel ??
      "Continuity seam ready",
    chips: [
      args.identitySummary.profile.persistenceLabel ?? args.identitySummary.source.label,
      args.homeRepeatVisitCue ? `${args.homeRepeatVisitCue.totalVisits} total visits` : "Visit cues warming up",
    ],
  };
}
