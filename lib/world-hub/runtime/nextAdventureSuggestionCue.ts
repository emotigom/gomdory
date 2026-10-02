import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { MetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import type { WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";

export type WorldHubNextAdventureSuggestionCue = {
  status: "idle" | "suggested";
  source: "deterministic-fallback" | "resolved-runtime";
  eyebrow: string;
  title: string;
  detail: string;
  hint: string;
  chipLabel: string;
  targetPortalId: string | null;
  targetPortalLabel: string | null;
};

function chooseSuggestedPortal(runtime: WorldHubRuntimeInputs) {
  return (
    runtime.portals.find((portal) => portal.availability === "available" && portal.entryCue === "suggested") ??
    runtime.portals.find((portal) => portal.entryCue === "suggested") ??
    runtime.portals.find((portal) => portal.availability === "available") ??
    runtime.portals[0] ??
    null
  );
}

function chooseNextPortalFromRecent(args: {
  runtime: WorldHubRuntimeInputs;
  recentMissionId: string | null;
}) {
  const { runtime, recentMissionId } = args;
  if (!recentMissionId) {
    return chooseSuggestedPortal(runtime);
  }

  const recentIndex = runtime.portals.findIndex((portal) => portal.id === recentMissionId);
  if (recentIndex < 0) {
    return chooseSuggestedPortal(runtime);
  }

  const afterRecent = runtime.portals
    .slice(recentIndex + 1)
    .find((portal) => portal.entryCue !== "unavailable" && portal.availability !== "locked");

  return afterRecent ?? chooseSuggestedPortal(runtime);
}

export function resolveWorldHubNextAdventureSuggestionCue(args: {
  runtime: WorldHubRuntimeInputs | null;
  identitySummary: MetaverseResolvedIdentitySummary;
  recentJourney: WorldHubRecentJourneyView;
}): WorldHubNextAdventureSuggestionCue {
  if (!args.runtime || args.runtime.portals.length === 0) {
    return {
      status: "idle",
      source: "deterministic-fallback",
      eyebrow: "Next trail",
      title: "A gentle next adventure cue will settle near home",
      detail: "Once your basecamp progress resolves, a quiet home-lane suggestion can point to the next trail without pulling focus from your porch.",
      hint: "Optional only — wander first, depart when it feels right.",
      chipLabel: "Suggestion cue warming up",
      targetPortalId: null,
      targetPortalLabel: null,
    };
  }

  const progressCompletion = args.runtime.progress.recentMissionCompletion;
  const recentMissionId = progressCompletion?.missionId ?? args.identitySummary.profile.lastMissionId ?? null;
  const recentMissionTitle =
    args.identitySummary.profile.lastMissionTitle ?? progressCompletion?.missionTitle ?? args.recentJourney.missionLabel;

  const targetPortal = chooseNextPortalFromRecent({
    runtime: args.runtime,
    recentMissionId,
  });

  if (!targetPortal) {
    return {
      status: "idle",
      source: "resolved-runtime",
      eyebrow: "Next trail",
      title: "Home is resting between adventures",
      detail: "No mission chain cue is active right now, so basecamp stays quiet and optional.",
      hint: "Check any glowing gate when you want a new route.",
      chipLabel: "No active suggestion",
      targetPortalId: null,
      targetPortalLabel: null,
    };
  }

  const rewardLine =
    progressCompletion?.rewardSummary?.highlightedRewardLabel ??
    progressCompletion?.rewardSummary?.summaryLabel ??
    args.identitySummary.profile.rewardLabel ??
    args.recentJourney.rewardLabel;

  const hasRecentSignal =
    args.recentJourney.status === "ready" || args.identitySummary.profile.hasCompletedMission || args.identitySummary.profile.hasRecentReward;

  if (!hasRecentSignal) {
    return {
      status: "idle",
      source: "resolved-runtime",
      eyebrow: "Next trail",
      title: `${targetPortal.label} is available whenever you are`,
      detail: "No recent chain signal is anchored yet, so this stays as a calm optional nudge.",
      hint: "Settle in at home first, then follow the trail glow if you feel like it.",
      chipLabel: `Optional · ${targetPortal.label}`,
      targetPortalId: targetPortal.id,
      targetPortalLabel: targetPortal.label,
    };
  }

  return {
    status: "suggested",
    source: "resolved-runtime",
    eyebrow: "Next trail",
    title: `${targetPortal.label} is a gentle next step`,
    detail: `After ${recentMissionTitle}, this lane can continue your journey${rewardLine ? ` while carrying ${rewardLine}.` : "."}`,
    hint:
      targetPortal.availability === "queued"
        ? "It is warming up now — feel free to stay home until the gate fully opens."
        : "A small signpost near home points this way. Follow it only when you feel ready.",
    chipLabel: `Next up · ${targetPortal.label}`,
    targetPortalId: targetPortal.id,
    targetPortalLabel: targetPortal.label,
  };
}
