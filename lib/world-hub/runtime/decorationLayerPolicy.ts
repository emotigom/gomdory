import type { WorldHubClassCelebrationCue } from "@/lib/world-hub/runtime/classCelebrationCues";
import type { WorldHubAcademyHomeCooldownCue } from "@/lib/world-hub/runtime/academyHomeCooldownCues";
import type { WorldHubAcademyPortalTempoCue } from "@/lib/world-hub/runtime/academyPortalTempoCues";
import type { WorldHubEndOfDayQuietStateCue } from "@/lib/world-hub/runtime/endOfDayQuietStateCues";
import type { WorldHubHomeLaneCelebrationProp } from "@/lib/world-hub/runtime/homeLaneCelebrationProps";
import type { WorldHubPlazaSessionWrapUpCue } from "@/lib/world-hub/runtime/plazaSessionWrapUpCues";
import type { WorldHubPortalRidgeAnticipationCue } from "@/lib/world-hub/runtime/portalRidgeAnticipationCues";
import type { WorldHubPortalExitReturnSoftnessCue } from "@/lib/world-hub/runtime/portalExitReturnSoftnessCues";
import type { WorldHubSessionCelebrationAccent } from "@/lib/world-hub/runtime/sessionCelebrationAccents";
import type { WorldHubResolvedSeasonalDecorationState } from "@/lib/world-hub/seasonal/contracts";

export type WorldHubDecorationLayerComposition = {
  homeLaneCelebrationProps: WorldHubHomeLaneCelebrationProp[];
  classCelebrationCues: WorldHubClassCelebrationCue[];
  academyHomeCooldownCues: WorldHubAcademyHomeCooldownCue[];
  academyPortalTempoCues: WorldHubAcademyPortalTempoCue[];
  plazaSessionWrapUpCues: WorldHubPlazaSessionWrapUpCue[];
  portalRidgeAnticipationCues: WorldHubPortalRidgeAnticipationCue[];
  portalExitReturnSoftnessCues: WorldHubPortalExitReturnSoftnessCue[];
  sessionCelebrationAccents: WorldHubSessionCelebrationAccent[];
  endOfDayQuietStateCues: WorldHubEndOfDayQuietStateCue[];
  seasonalLayers: WorldHubResolvedSeasonalDecorationState["layers"];
  summaryChips: string[];
};

function hasSeasonalSuppression(
  seasonal: WorldHubResolvedSeasonalDecorationState,
  target: "home-lane-celebration" | "class-celebration" | "session-celebration",
) {
  return seasonal.layers.some((layer) => layer.active && layer.suppresses.includes(target));
}

export function resolveWorldHubDecorationLayerComposition(args: {
  homeLaneCelebrationProps: WorldHubHomeLaneCelebrationProp[];
  classCelebrationCues: WorldHubClassCelebrationCue[];
  academyHomeCooldownCues: WorldHubAcademyHomeCooldownCue[];
  academyPortalTempoCues: WorldHubAcademyPortalTempoCue[];
  plazaSessionWrapUpCues: WorldHubPlazaSessionWrapUpCue[];
  portalRidgeAnticipationCues: WorldHubPortalRidgeAnticipationCue[];
  portalExitReturnSoftnessCues?: WorldHubPortalExitReturnSoftnessCue[];
  sessionCelebrationAccents: WorldHubSessionCelebrationAccent[];
  endOfDayQuietStateCues: WorldHubEndOfDayQuietStateCue[];
  seasonal: WorldHubResolvedSeasonalDecorationState;
}): WorldHubDecorationLayerComposition {
  const suppressHomeLaneCelebration = hasSeasonalSuppression(args.seasonal, "home-lane-celebration");
  const suppressClassCelebration = hasSeasonalSuppression(args.seasonal, "class-celebration");
  const suppressSessionCelebration = hasSeasonalSuppression(args.seasonal, "session-celebration");

  const classCelebrationCues = suppressClassCelebration
    ? []
    : args.classCelebrationCues;

  const hasActiveClassCue = classCelebrationCues.some((entry) => entry.active);
  const academyHomeCooldownCues = hasActiveClassCue
    ? []
    : args.academyHomeCooldownCues;
  const plazaSessionWrapUpCues = suppressSessionCelebration || hasActiveClassCue
    ? []
    : args.plazaSessionWrapUpCues;
  const academyPortalTempoCues = args.academyPortalTempoCues;
  const portalRidgeAnticipationCues = args.portalRidgeAnticipationCues.map((cue) => {
    if (!hasActiveClassCue) return cue;
    return {
      ...cue,
      active: false,
      tone: "quiet" as const,
    };
  });
  const portalExitReturnSoftnessCues = (args.portalExitReturnSoftnessCues ?? []).map((cue) => {
    if (!hasActiveClassCue) return cue;
    return {
      ...cue,
      active: false,
      tone: "quiet" as const,
    };
  });

  const sessionCelebrationAccents = suppressSessionCelebration || hasActiveClassCue
    ? []
    : args.sessionCelebrationAccents;
  const hasActiveSessionWrapUpCue = plazaSessionWrapUpCues.some((entry) => entry.active);
  const hasActiveSessionCelebrationAccent = sessionCelebrationAccents.some((entry) => entry.active);
  const hasActiveCooldownCue = academyHomeCooldownCues.some((entry) => entry.active);
  const endOfDayQuietStateCues = hasActiveClassCue || hasActiveSessionWrapUpCue || hasActiveSessionCelebrationAccent || hasActiveCooldownCue
    ? []
    : args.endOfDayQuietStateCues;

  const homeLaneCelebrationProps = suppressHomeLaneCelebration
    ? args.homeLaneCelebrationProps.map((entry) => ({
        ...entry,
        active: false,
        tone: "quiet" as const,
      }))
    : args.homeLaneCelebrationProps;

  const summaryChips = [
    args.seasonal.status === "active" ? "Seasonal active" : args.seasonal.status === "upcoming" ? "Seasonal upcoming" : "Seasonal resting",
    hasActiveClassCue ? "Class cues prioritized" : "Class cues passive",
    academyHomeCooldownCues.length > 0 ? "Cooldown lane visible" : "Cooldown lane suppressed",
    academyPortalTempoCues.some((entry) => entry.active) ? "Set-off tempo active" : "Set-off tempo subtle",
    plazaSessionWrapUpCues.length > 0 ? "Plaza wrap-up visible" : "Plaza wrap-up suppressed",
    portalRidgeAnticipationCues.some((entry) => entry.active) ? "Portal ridge anticipation active" : "Portal ridge anticipation subtle",
    portalExitReturnSoftnessCues.some((entry) => entry.active) ? "Portal return landing active" : "Portal return landing subtle",
    sessionCelebrationAccents.length > 0 ? "Session accents visible" : "Session accents suppressed",
    endOfDayQuietStateCues.length > 0 ? "End-of-day quiet visible" : "End-of-day quiet suppressed",
  ];

  return {
    homeLaneCelebrationProps,
    classCelebrationCues,
    academyHomeCooldownCues,
    academyPortalTempoCues,
    plazaSessionWrapUpCues,
    portalRidgeAnticipationCues,
    portalExitReturnSoftnessCues,
    sessionCelebrationAccents,
    endOfDayQuietStateCues,
    seasonalLayers: args.seasonal.layers,
    summaryChips,
  };
}
