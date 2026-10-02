import type { WorldHubFirstVisitOnboardingPhase } from "@/lib/world-hub/runtime/worldHubFirstVisitOnboarding";
import type { WorldHubHomeZoneState } from "@/lib/world-hub/runtime/homeArrivalFeedback";
import type { WorldHubJourneyPresentationProgression } from "@/lib/world-hub/runtime/journeyPresentationProgression";

export type WorldHubHintProminence = "primary" | "secondary" | "subtle" | "hidden";
export type WorldHubHintSurface = "home-return" | "portal" | "onboarding" | "class-session" | "none";
export type WorldHubClassSessionStage = "gather" | "prepare" | "launch";

export type WorldHubHintDensity = {
  primarySurface: WorldHubHintSurface;
  onboardingProminence: WorldHubHintProminence;
  homeReturnProminence: WorldHubHintProminence;
  portalProminence: WorldHubHintProminence;
  classSessionProminence: WorldHubHintProminence;
  showAmbientFeedback: boolean;
  showPortalEntryFeedback: boolean;
  portalContextRelevant: boolean;
};

function isPortalContextRelevant(args: {
  progression: WorldHubJourneyPresentationProgression;
  hasFocusedPortal: boolean;
  hasSelectedPortal: boolean;
}) {
  return (
    args.hasFocusedPortal ||
    args.hasSelectedPortal ||
    args.progression.currentStage === "portal" ||
    args.progression.pathGuidanceProminence === "primary" ||
    args.progression.readinessProminence === "primary" ||
    args.progression.portalAnticipationProminence === "primary"
  );
}

export function resolveWorldHubHintDensity(args: {
  onboardingPhase: WorldHubFirstVisitOnboardingPhase;
  homeZoneState: WorldHubHomeZoneState;
  progression: WorldHubJourneyPresentationProgression;
  hasAmbientFeedback: boolean;
  hasFocusedPortal: boolean;
  hasSelectedPortal: boolean;
  hasPortalEntryFeedback: boolean;
  hasClassSessionGuidance: boolean;
  classSessionStage: WorldHubClassSessionStage | null;
}): WorldHubHintDensity {
  const portalContextRelevant = isPortalContextRelevant({
    progression: args.progression,
    hasFocusedPortal: args.hasFocusedPortal,
    hasSelectedPortal: args.hasSelectedPortal,
  });
  const homeReturnPrimaryWindow =
    args.progression.emphasis === "return-softness" || (args.homeZoneState === "arrived" && args.hasAmbientFeedback);

  const classSessionProminence: WorldHubHintProminence = !args.hasClassSessionGuidance
    ? "hidden"
    : args.classSessionStage === "launch"
      ? "primary"
      : portalContextRelevant
        ? "secondary"
        : "primary";

  const portalProminence: WorldHubHintProminence = args.hasClassSessionGuidance
    ? args.classSessionStage === "launch"
      ? portalContextRelevant
        ? "secondary"
        : "subtle"
      : portalContextRelevant
        ? "secondary"
        : args.hasPortalEntryFeedback
          ? "subtle"
          : "hidden"
    : portalContextRelevant
      ? homeReturnPrimaryWindow
        ? "secondary"
        : "primary"
      : args.hasPortalEntryFeedback
        ? "subtle"
        : "hidden";

  const homeReturnProminence: WorldHubHintProminence = homeReturnPrimaryWindow
    ? "primary"
    : args.homeZoneState === "approaching"
      ? "secondary"
      : "subtle";

  const primarySurface: WorldHubHintSurface =
    classSessionProminence === "primary"
      ? "class-session"
      : homeReturnProminence === "primary"
      ? "home-return"
      : portalProminence === "primary"
        ? "portal"
        : args.onboardingPhase !== "hidden"
          ? "onboarding"
          : "none";

  const onboardingProminence: WorldHubHintProminence =
    args.onboardingPhase === "hidden"
      ? "hidden"
      : primarySurface === "class-session"
        ? "subtle"
      : args.onboardingPhase === "expanded"
        ? primarySurface === "onboarding"
          ? "primary"
          : "secondary"
        : primarySurface === "home-return" || primarySurface === "portal"
          ? "subtle"
          : "secondary";

  return {
    primarySurface,
    onboardingProminence,
    homeReturnProminence,
    portalProminence,
    classSessionProminence,
    showAmbientFeedback: args.hasAmbientFeedback && primarySurface !== "portal",
    showPortalEntryFeedback: args.hasPortalEntryFeedback && portalProminence !== "hidden",
    portalContextRelevant,
  };
}
