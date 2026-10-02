import type { WorldHubSeasonalDecorationLayer } from "@/lib/world-hub/seasonal/contracts";
import type { WorldHubHomeLanePlaceholderSignal } from "@/lib/world-hub/runtime/homeLanePersonalization";
import type { WorldHubHomeLaneCelebrationProp } from "@/lib/world-hub/runtime/homeLaneCelebrationProps";
import type { WorldHubHomeRepeatVisitCue } from "@/lib/world-hub/runtime/homeRepeatVisitCue";
import type { WorldHubHomeReturnMemoryMarker } from "@/lib/world-hub/runtime/homeReturnMemoryMarkers";
import type { WorldHubEndOfDayQuietStateCue } from "@/lib/world-hub/runtime/endOfDayQuietStateCues";
import type { WorldHubClassCelebrationCue } from "@/lib/world-hub/runtime/classCelebrationCues";
import type { WorldHubSessionCelebrationAccent } from "@/lib/world-hub/runtime/sessionCelebrationAccents";
import type { WorldHubPlazaSessionWrapUpCue } from "@/lib/world-hub/runtime/plazaSessionWrapUpCues";
import type { WorldHubAcademyHomeCooldownCue } from "@/lib/world-hub/runtime/academyHomeCooldownCues";
import type { WorldHubAcademyPortalTempoCue } from "@/lib/world-hub/runtime/academyPortalTempoCues";
import type { WorldHubPortalRidgeAnticipationCue } from "@/lib/world-hub/runtime/portalRidgeAnticipationCues";
import type { WorldHubPortalExitReturnSoftnessCue } from "@/lib/world-hub/runtime/portalExitReturnSoftnessCues";
import type { WorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import type { WorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";
import type { WorldHubJourneyPathGuidance } from "@/lib/world-hub/runtime/journeyPathGuidance";

export type WorldHubResolvedEmotionPresentation = {
  homeLane: {
    signals: WorldHubHomeLanePlaceholderSignal[];
    celebrationProps: WorldHubHomeLaneCelebrationProp[];
    repeatVisitCue: WorldHubHomeRepeatVisitCue | null;
    returnMemoryMarkers: WorldHubHomeReturnMemoryMarker[];
    quietStateCues: WorldHubEndOfDayQuietStateCue[];
  };
  centralPlaza: {
    classCelebrationCues: WorldHubClassCelebrationCue[];
    sessionCelebrationAccents: WorldHubSessionCelebrationAccent[];
    sessionWrapUpCues: WorldHubPlazaSessionWrapUpCue[];
  };
  academyLodge: {
    cooldownCues: WorldHubAcademyHomeCooldownCue[];
    tempoCues: WorldHubAcademyPortalTempoCue[];
  };
  portalRidge: {
    anticipationCues: WorldHubPortalRidgeAnticipationCue[];
    exitReturnCues: WorldHubPortalExitReturnSoftnessCue[];
    nextAdventureSuggestion: WorldHubNextAdventureSuggestionCue;
    readinessCue: WorldHubNextAdventureReadinessCue;
    journeyPathGuidance: WorldHubJourneyPathGuidance;
  };
  seasonal: {
    layers: readonly WorldHubSeasonalDecorationLayer[];
    hasActiveLayer: boolean;
  };
  diagnostics: {
    source: "resolved-runtime" | "deterministic-fallback";
    summaryChips: string[];
  };
};

export function resolveWorldHubEmotionPresentation(args: {
  hasRuntime: boolean;
  homeLaneSignals: WorldHubHomeLanePlaceholderSignal[];
  homeLaneCelebrationProps: WorldHubHomeLaneCelebrationProp[];
  homeRepeatVisitCue: WorldHubHomeRepeatVisitCue | null;
  homeReturnMemoryMarkers: WorldHubHomeReturnMemoryMarker[];
  classCelebrationCues: WorldHubClassCelebrationCue[];
  sessionCelebrationAccents: WorldHubSessionCelebrationAccent[];
  plazaSessionWrapUpCues: WorldHubPlazaSessionWrapUpCue[];
  academyHomeCooldownCues: WorldHubAcademyHomeCooldownCue[];
  academyPortalTempoCues: WorldHubAcademyPortalTempoCue[];
  endOfDayQuietStateCues: WorldHubEndOfDayQuietStateCue[];
  portalRidgeAnticipationCues: WorldHubPortalRidgeAnticipationCue[];
  portalExitReturnSoftnessCues: WorldHubPortalExitReturnSoftnessCue[];
  nextAdventureSuggestion: WorldHubNextAdventureSuggestionCue;
  homeReadinessCue: WorldHubNextAdventureReadinessCue;
  journeyPathGuidance: WorldHubJourneyPathGuidance;
  seasonalDecorationLayers: readonly WorldHubSeasonalDecorationLayer[];
  summaryChips: string[];
}): WorldHubResolvedEmotionPresentation {
  return {
    homeLane: {
      signals: args.homeLaneSignals,
      celebrationProps: args.homeLaneCelebrationProps,
      repeatVisitCue: args.homeRepeatVisitCue,
      returnMemoryMarkers: args.homeReturnMemoryMarkers,
      quietStateCues: args.endOfDayQuietStateCues,
    },
    centralPlaza: {
      classCelebrationCues: args.classCelebrationCues,
      sessionCelebrationAccents: args.sessionCelebrationAccents,
      sessionWrapUpCues: args.plazaSessionWrapUpCues,
    },
    academyLodge: {
      cooldownCues: args.academyHomeCooldownCues,
      tempoCues: args.academyPortalTempoCues,
    },
    portalRidge: {
      anticipationCues: args.portalRidgeAnticipationCues,
      exitReturnCues: args.portalExitReturnSoftnessCues,
      nextAdventureSuggestion: args.nextAdventureSuggestion,
      readinessCue: args.homeReadinessCue,
      journeyPathGuidance: args.journeyPathGuidance,
    },
    seasonal: {
      layers: args.seasonalDecorationLayers,
      hasActiveLayer: args.seasonalDecorationLayers.some((entry) => entry.status === "active"),
    },
    diagnostics: {
      source: args.hasRuntime ? "resolved-runtime" : "deterministic-fallback",
      summaryChips: args.summaryChips,
    },
  };
}
