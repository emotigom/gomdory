import type { WorldHubHomeZoneState, WorldHubAmbientFeedback } from "@/lib/world-hub/runtime/homeArrivalFeedback";
import type { WorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import type { WorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";
import type { WorldHubJourneyPathGuidance } from "@/lib/world-hub/runtime/journeyPathGuidance";

export type WorldHubJourneyPresentationStage = "home" | "academy" | "portal";
export type WorldHubJourneyPresentationEmphasis = "settled-home" | "staging" | "ready-to-depart" | "return-softness";
export type WorldHubJourneyPresentationProminence = "primary" | "secondary" | "subtle" | "resting";

export type WorldHubJourneyPresentationProgression = {
  currentStage: WorldHubJourneyPresentationStage;
  emphasis: WorldHubJourneyPresentationEmphasis;
  homeAnchorPresence: "primary" | "supporting";
  suggestionProminence: WorldHubJourneyPresentationProminence;
  readinessProminence: WorldHubJourneyPresentationProminence;
  pathGuidanceProminence: WorldHubJourneyPresentationProminence;
  academyTempoProminence: WorldHubJourneyPresentationProminence;
  portalAnticipationProminence: WorldHubJourneyPresentationProminence;
};

export function resolveWorldHubJourneyPresentationProgression(args: {
  homeZoneState: WorldHubHomeZoneState;
  ambientFeedback: WorldHubAmbientFeedback | null;
  homeAcknowledgementEmphasis: "fresh" | "settled" | "none";
  academyFocused: boolean;
  academyTempoActive: boolean;
  readinessCue: WorldHubNextAdventureReadinessCue;
  suggestionCue: WorldHubNextAdventureSuggestionCue;
  pathGuidance: WorldHubJourneyPathGuidance;
  hasFocusedPortal: boolean;
  hasSelectedPortal: boolean;
  portalAnticipationActive: boolean;
  returnSoftnessActive: boolean;
}): WorldHubJourneyPresentationProgression {
  const hasReturnWindow =
    args.ambientFeedback?.kind === "return" ||
    args.returnSoftnessActive ||
    (args.homeZoneState === "arrived" && args.homeAcknowledgementEmphasis === "fresh");

  const hasPortalIntent = args.hasFocusedPortal || args.hasSelectedPortal;
  const portalReady = args.readinessCue.status === "ready";
  const pathActive = args.pathGuidance.status === "active";
  const portalPrimaryEligible = portalReady && (hasPortalIntent || args.portalAnticipationActive || pathActive);

  const academyBridgeActive = args.academyFocused || args.academyTempoActive;

  if (hasReturnWindow) {
    return {
      currentStage: "home",
      emphasis: "return-softness",
      homeAnchorPresence: "primary",
      suggestionProminence: args.suggestionCue.status === "suggested" ? "subtle" : "resting",
      readinessProminence: args.readinessCue.status === "resting" ? "resting" : "subtle",
      pathGuidanceProminence: args.pathGuidance.status === "resting" ? "resting" : "subtle",
      academyTempoProminence: academyBridgeActive ? "subtle" : "resting",
      portalAnticipationProminence: args.portalAnticipationActive ? "subtle" : "resting",
    };
  }

  if (portalPrimaryEligible) {
    return {
      currentStage: "portal",
      emphasis: "ready-to-depart",
      homeAnchorPresence: "supporting",
      suggestionProminence: args.suggestionCue.status === "suggested" ? "secondary" : "resting",
      readinessProminence: "primary",
      pathGuidanceProminence: pathActive ? "primary" : args.pathGuidance.status === "suggested" ? "secondary" : "resting",
      academyTempoProminence: academyBridgeActive ? "subtle" : "resting",
      portalAnticipationProminence: args.portalAnticipationActive ? "primary" : "secondary",
    };
  }

  if (academyBridgeActive) {
    return {
      currentStage: "academy",
      emphasis: "staging",
      homeAnchorPresence: "supporting",
      suggestionProminence: args.suggestionCue.status === "suggested" ? "subtle" : "resting",
      readinessProminence: args.readinessCue.status === "ready" ? "secondary" : args.readinessCue.status === "warming" ? "secondary" : "resting",
      pathGuidanceProminence: args.pathGuidance.status === "active" ? "secondary" : args.pathGuidance.status === "suggested" ? "subtle" : "resting",
      academyTempoProminence: "primary",
      portalAnticipationProminence: args.portalAnticipationActive ? "subtle" : "resting",
    };
  }

  return {
    currentStage: "home",
    emphasis: "settled-home",
    homeAnchorPresence: "primary",
    suggestionProminence: args.suggestionCue.status === "suggested" ? "secondary" : "resting",
    readinessProminence: args.readinessCue.status === "ready" ? "subtle" : args.readinessCue.status === "warming" ? "secondary" : "resting",
    pathGuidanceProminence: args.pathGuidance.status === "active" ? "subtle" : args.pathGuidance.status === "suggested" ? "subtle" : "resting",
    academyTempoProminence: academyBridgeActive ? "subtle" : "resting",
    portalAnticipationProminence: hasPortalIntent && args.portalAnticipationActive ? "subtle" : "resting",
  };
}
