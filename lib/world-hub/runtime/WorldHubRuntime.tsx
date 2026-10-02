"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getNextLessonId } from "@/lib/coding-studio/lessons";
import { loadCodingStudioProgression } from "@/lib/coding-studio/progressionStore";
import { buildAssignmentEcho, loadAssignmentResumeState, loadCodingStudioAssignments, resolveActiveAssignment } from "@/lib/coding-studio/assignmentStore";
import type { LessonId } from "@/lib/coding-studio/types";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";
import { resolveMetaverseIdentitySummary } from "@/lib/world-hub/identity/adapter";
import { getWorldHubMissionPolicyDecision } from "@/lib/world-hub/policy/contracts";

import { WorldHubHud } from "./WorldHubHud";
import { WorldHubSceneViewport } from "./WorldHubSceneViewport";
import { WorldHubSceneCanvas3D } from "./WorldHubSceneCanvas3D";
import { useWorldHubController } from "./useWorldHubController";
import { useWorldHubHomeArrivalFeedback } from "./homeArrivalFeedback";
import { useWorldHubHomeAnchorAcknowledgement } from "./homeAnchorAcknowledgement";
import { resolveWorldHubHomeLanePersonalization } from "./homeLanePersonalization";
import { resolveWorldHubHomeLaneCelebrationProps } from "./homeLaneCelebrationProps";
import { useWorldHubHomeRepeatVisitCue } from "./homeRepeatVisitCue";
import { buildWorldHubHudViewModel } from "./worldHubHudModel";
import { resolveWorldHubClassCelebrationCues } from "./classCelebrationCues";
import { resolveWorldHubPlazaSessionWrapUpCues } from "./plazaSessionWrapUpCues";
import { resolveWorldHubAcademyHomeCooldownCues } from "./academyHomeCooldownCues";
import { resolveWorldHubAcademyPortalTempoCues } from "./academyPortalTempoCues";
import { resolveWorldHubSessionCelebrationAccents } from "./sessionCelebrationAccents";
import { resolveWorldHubDecorationLayerComposition } from "./decorationLayerPolicy";
import { resolveWorldHubEndOfDayQuietStateCues } from "./endOfDayQuietStateCues";
import { resolveWorldHubHomeReturnMemoryMarkerState } from "./homeReturnMemoryMarkers";
import { resolveWorldHubPortalRidgeAnticipationCues } from "./portalRidgeAnticipationCues";
import { resolveWorldHubPortalExitReturnSoftnessCues } from "./portalExitReturnSoftnessCues";
import { resolveWorldHubEmotionPresentation, type WorldHubResolvedEmotionPresentation } from "./emotionPresentationModel";
import { resolveWorldHubJourneyPresentationProgression } from "./journeyPresentationProgression";
import { resolveWorldHubHintDensity } from "./worldHubHintDensity";
import type { WorldHubHintDensity } from "./worldHubHintDensity";
import { resolveWorldHubClassSessionLaneAccents } from "./worldHubClassSessionLaneAccents";
import { useWorldHubFirstVisitOnboarding } from "./worldHubFirstVisitOnboarding";
import {
  isWorldHubMovementIntentKey,
  resolveWorldHubMovementInputFromPressedKeys,
  type WorldHubMovementInput,
} from "./worldHubMovementController";
import { resolveWorldHubRendererMode } from "./worldHubRendererMode";

function useWorldHubInput(onMovementIntent: (input: WorldHubMovementInput) => void, onInteract: () => void, onJoin: () => void) {
  useEffect(() => {
    const pressed = new Set<string>();
    const syncMovementIntent = () => {
      onMovementIntent(resolveWorldHubMovementInputFromPressedKeys(pressed));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (isWorldHubMovementIntentKey(key)) {
        event.preventDefault();
        pressed.add(key);
        syncMovementIntent();
      }

      if (key === "e") {
        event.preventDefault();
        onInteract();
      }

      if (key === "enter") {
        event.preventDefault();
        onJoin();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (isWorldHubMovementIntentKey(key)) {
        pressed.delete(key);
        syncMovementIntent();
      }
    };
    const onBlur = () => {
      if (pressed.size === 0) return;
      pressed.clear();
      syncMovementIntent();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [onInteract, onJoin, onMovementIntent]);
}

function ViewportGrid({
  runtime,
  player,
  camera,
  focusedPortalId,
  selectedPortalId,
  homeFocused,
  academyFocused,
  emotionPresentation,
  presentationProgression,
  hintDensity,
  classSessionLaneAccents,
  onPortalSelect,
  rendererMode,
}: {
  runtime: NonNullable<ReturnType<typeof useWorldHubController>["runtime"]>;
  player: NonNullable<ReturnType<typeof useWorldHubController>["player"]>;
  camera: ReturnType<typeof useWorldHubController>["camera"];
  focusedPortalId: string | null;
  selectedPortalId: string | null;
  homeFocused: boolean;
  academyFocused: boolean;
  emotionPresentation: WorldHubResolvedEmotionPresentation;
  presentationProgression: ReturnType<typeof resolveWorldHubJourneyPresentationProgression>;
  hintDensity: WorldHubHintDensity;
  classSessionLaneAccents: ReturnType<typeof resolveWorldHubClassSessionLaneAccents>;
  onPortalSelect: (portalId: string) => void;
  rendererMode: "legacy" | "r3f";
}) {
  if (rendererMode === "r3f") {
    return (
      <WorldHubSceneCanvas3D
        academyFocused={academyFocused}
        camera={camera}
        emotionPresentation={emotionPresentation}
        focusedPortalId={focusedPortalId}
        homeFocused={homeFocused}
        onPortalSelect={onPortalSelect}
        presentationProgression={presentationProgression}
        hintDensity={hintDensity}
        classSessionLaneAccents={classSessionLaneAccents}
        player={player}
        runtime={runtime}
        selectedPortalId={selectedPortalId}
      />
    );
  }

  return (
    <WorldHubSceneViewport
      academyFocused={academyFocused}
      camera={camera}
      emotionPresentation={emotionPresentation}
      focusedPortalId={focusedPortalId}
      homeFocused={homeFocused}
      onPortalSelect={onPortalSelect}
      presentationProgression={presentationProgression}
      hintDensity={hintDensity}
      classSessionLaneAccents={classSessionLaneAccents}
      player={player}
      runtime={runtime}
      selectedPortalId={selectedPortalId}
    />
  );
}

export default function WorldHubRuntime({
  recentMissionResult = null,
  launchClassId = null,
}: {
  recentMissionResult?: WorldHubMissionResultReturnEnvelope | null;
  launchClassId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rendererMode = resolveWorldHubRendererMode(searchParams.get("whRenderer"));
  const [codingStudioProgression, setCodingStudioProgression] = useState<{ currentLessonId: LessonId; nextLessonId: LessonId | null } | null>(null);
  const [codingStudioAssignment, setCodingStudioAssignment] = useState<{ title: string; currentLessonId: LessonId; nextLessonId: LessonId | null } | null>(null);
  const controller = useWorldHubController({
    launchClassId,
    navigateToMission: (route) => router.push(route),
  });
  useEffect(() => {
    const progression = loadCodingStudioProgression();
    setCodingStudioProgression({
      currentLessonId: progression.currentLessonId,
      nextLessonId: getNextLessonId(progression.currentLessonId),
    });
    const resume = loadAssignmentResumeState();
    const assignments = loadCodingStudioAssignments();
    const assignment = resolveActiveAssignment({ assignments, resume });
    setCodingStudioAssignment(buildAssignmentEcho({ assignment, resume }));
  }, []);
  const firstVisitOnboarding = useWorldHubFirstVisitOnboarding({
    worldId: controller.runtime?.scene.worldId ?? null,
    movementSpeed: controller.player?.speed ?? 0,
  });
  useWorldHubInput(
    controller.moveByInput,
    () => {
      void controller.triggerInteract();
    },
    () => {
      void controller.joinSelectedPortal();
    },
  );

  const { activeFeedback, homeZoneState } = useWorldHubHomeArrivalFeedback({
    runtime: controller.runtime,
    playerPosition: controller.player?.position ?? null,
    recentMissionResult,
  });
  const { acknowledgement } = useWorldHubHomeAnchorAcknowledgement({
    worldId: controller.runtime?.scene.worldId ?? recentMissionResult?.payload.worldId ?? null,
    progress: controller.runtime?.progress ?? null,
    recentMissionResult,
  });
  const { cue: homeRepeatVisitCue } = useWorldHubHomeRepeatVisitCue({
    worldId: controller.runtime?.scene.worldId ?? recentMissionResult?.payload.worldId ?? null,
    homeZoneState,
  });
  const identitySummary = useMemo(
    () =>
      resolveMetaverseIdentitySummary({
        runtime: controller.runtime,
        recentMissionResult,
      }),
    [controller.runtime, recentMissionResult],
  );

  const homeLanePersonalization = useMemo(
    () =>
      resolveWorldHubHomeLanePersonalization({
        runtime: controller.runtime,
        identitySummary,
        homeZoneState,
      }),
    [controller.runtime, identitySummary, homeZoneState],
  );
  const homeLaneCelebrationProps = useMemo(
    () =>
      resolveWorldHubHomeLaneCelebrationProps({
        runtime: controller.runtime,
        homeLaneSignals: homeLanePersonalization.signals,
        homeZoneState,
        ambientFeedback: activeFeedback,
      }),
    [activeFeedback, controller.runtime, homeLanePersonalization.signals, homeZoneState],
  );

  const classCelebration = useMemo(
    () =>
      resolveWorldHubClassCelebrationCues({
        runtime: controller.runtime,
        launchClassId,
        recentMissionResult,
      }),
    [controller.runtime, launchClassId, recentMissionResult],
  );
  const sessionCelebration = useMemo(
    () =>
      resolveWorldHubSessionCelebrationAccents({
        runtime: controller.runtime,
        recentMissionResult,
      }),
    [controller.runtime, recentMissionResult],
  );
  const plazaWrapUp = useMemo(
    () =>
      resolveWorldHubPlazaSessionWrapUpCues({
        runtime: controller.runtime,
        recentMissionResult,
      }),
    [controller.runtime, recentMissionResult],
  );
  const endOfDayQuietState = useMemo(
    () =>
      resolveWorldHubEndOfDayQuietStateCues({
        runtime: controller.runtime,
        recentMissionResult,
      }),
    [controller.runtime, recentMissionResult],
  );
  const academyHomeCooldown = useMemo(
    () =>
      resolveWorldHubAcademyHomeCooldownCues({
        runtime: controller.runtime,
        recentMissionResult,
      }),
    [controller.runtime, recentMissionResult],
  );
  const seasonalDecorationState = controller.runtime?.seasonalDecorations ?? null;

  const selectedPortal = useMemo(() => {
    if (!controller.runtime || !controller.selectedPortalId) return null;
    return controller.runtime.portals.find((portal) => portal.id === controller.selectedPortalId) ?? null;
  }, [controller.runtime, controller.selectedPortalId]);

  const portalForPanel = selectedPortal ?? controller.focusedPortal;
  const todaysAdventure = useMemo(() => {
    if (!controller.runtime) return null;
    return (
      portalForPanel ??
      controller.runtime.portals.find((portal) => portal.entryCue === "suggested") ??
      controller.runtime.portals.find((portal) => portal.availability === "available") ??
      controller.runtime.portals[0] ??
      null
    );
  }, [controller.runtime, portalForPanel]);

  const selectedPortalPolicy = useMemo(() => {
    if (!controller.policy || !todaysAdventure) return null;
    return getWorldHubMissionPolicyDecision({
      policy: controller.policy,
      missionId: todaysAdventure.id,
    });
  }, [controller.policy, todaysAdventure]);

  const hudViewModelSeed = useMemo(
    () =>
      buildWorldHubHudViewModel({
        runtime: controller.runtime,
        sceneLoading: controller.sceneLoading,
        statusText: controller.statusText,
        loading: controller.loading,
        errorText: controller.errorText,
        focusedPortal: controller.focusedPortal,
        kioskFocused: controller.kioskFocused,
        joiningPortalId: controller.joiningPortalId,
        selectedPortalId: controller.selectedPortalId,
        selectedPortalPolicy,
        identitySummary,
        homeZoneState,
        ambientFeedback: activeFeedback,
        homeAcknowledgement: acknowledgement,
        homeRepeatVisitCue,
        homeLanePersonalization,
        classCelebrationSummary: classCelebration.summary,
        sessionCelebrationSummary: sessionCelebration.summary,
        seasonalDecorationSummary: seasonalDecorationState?.summary ?? null,
        presentationProgression: {
          currentStage: "home",
          emphasis: "settled-home",
          homeAnchorPresence: "primary",
          suggestionProminence: "secondary",
          readinessProminence: "secondary",
          pathGuidanceProminence: "subtle",
          academyTempoProminence: "resting",
          portalAnticipationProminence: "resting",
        },
        recentMissionResult,
        codingStudioProgression,
        codingStudioAssignment,
      }),
    [
      controller.errorText,
      controller.focusedPortal,
      controller.joiningPortalId,
      controller.kioskFocused,
      controller.loading,
      controller.runtime,
      controller.sceneLoading,
      controller.selectedPortalId,
      controller.statusText,
      identitySummary,
      selectedPortalPolicy,
      homeZoneState,
      activeFeedback,
      acknowledgement,
      homeRepeatVisitCue,
      homeLanePersonalization,
      classCelebration.summary,
      sessionCelebration.summary,
      seasonalDecorationState?.summary,
      recentMissionResult,
      codingStudioProgression,
      codingStudioAssignment,
    ],
  );
  const presentationProgression = useMemo(
    () =>
      resolveWorldHubJourneyPresentationProgression({
        homeZoneState,
        ambientFeedback: activeFeedback,
        homeAcknowledgementEmphasis: acknowledgement?.emphasis ?? "none",
        academyFocused: controller.kioskFocused,
        academyTempoActive:
          controller.runtime?.liveSession.cueState === "prepare_at_academy" ||
          controller.runtime?.liveSession.cueState === "start_mission",
        readinessCue: hudViewModelSeed.homeReadinessCue,
        suggestionCue: hudViewModelSeed.nextAdventureSuggestion,
        pathGuidance: hudViewModelSeed.journeyPathGuidance,
        hasFocusedPortal: Boolean(controller.focusedPortal),
        hasSelectedPortal: Boolean(controller.selectedPortalId),
        portalAnticipationActive:
          hudViewModelSeed.homeReadinessCue.status === "ready" || hudViewModelSeed.journeyPathGuidance.status !== "resting",
        returnSoftnessActive: Boolean(recentMissionResult) && homeZoneState !== "away",
      }),
    [
      acknowledgement,
      activeFeedback,
      controller.focusedPortal,
      controller.kioskFocused,
      controller.runtime?.liveSession.cueState,
      controller.selectedPortalId,
      homeZoneState,
      recentMissionResult,
      hudViewModelSeed.homeReadinessCue,
      hudViewModelSeed.journeyPathGuidance,
      hudViewModelSeed.nextAdventureSuggestion,
    ],
  );
  const hudViewModel = useMemo(
    () => ({
      ...hudViewModelSeed,
      presentationProgression,
    }),
    [hudViewModelSeed, presentationProgression],
  );
  const hintDensity = useMemo(
    () =>
      resolveWorldHubHintDensity({
        onboardingPhase: firstVisitOnboarding.view.phase,
        homeZoneState,
        progression: presentationProgression,
        hasAmbientFeedback: Boolean(activeFeedback),
        hasFocusedPortal: Boolean(controller.focusedPortal),
        hasSelectedPortal: Boolean(controller.selectedPortalId),
        hasPortalEntryFeedback: Boolean(controller.portalEntryFeedback),
        hasClassSessionGuidance: Boolean(hudViewModel.classSessionGuidanceCard?.visible),
        classSessionStage: hudViewModel.classSessionGuidanceCard?.stage ?? null,
      }),
    [
      firstVisitOnboarding.view.phase,
      homeZoneState,
      presentationProgression,
      activeFeedback,
      controller.focusedPortal,
      controller.selectedPortalId,
      controller.portalEntryFeedback,
      hudViewModel.classSessionGuidanceCard?.visible,
      hudViewModel.classSessionGuidanceCard?.stage,
    ],
  );
  const classSessionLaneAccents = useMemo(
    () =>
      resolveWorldHubClassSessionLaneAccents({
        liveSession: controller.runtime?.liveSession ?? null,
        hintDensity,
      }),
    [controller.runtime?.liveSession, hintDensity],
  );
  const homeReturnMemoryMarkerState = useMemo(
    () =>
      resolveWorldHubHomeReturnMemoryMarkerState({
        runtime: controller.runtime,
        identitySummary,
        recentJourney: hudViewModel.recentJourney,
        homeRepeatVisitCue,
      }),
    [controller.runtime, homeRepeatVisitCue, hudViewModel.recentJourney, identitySummary],
  );
  const portalRidgeAnticipation = useMemo(
    () =>
      resolveWorldHubPortalRidgeAnticipationCues({
        runtime: controller.runtime,
        homeReadinessCue: hudViewModel.homeReadinessCue,
        journeyPathGuidance: hudViewModel.journeyPathGuidance,
      }),
    [controller.runtime, hudViewModel.homeReadinessCue, hudViewModel.journeyPathGuidance],
  );
  const portalExitReturnSoftness = useMemo(
    () =>
      resolveWorldHubPortalExitReturnSoftnessCues({
        runtime: controller.runtime,
        recentMissionResult,
      }),
    [controller.runtime, recentMissionResult],
  );
  const academyPortalTempo = useMemo(
    () =>
      resolveWorldHubAcademyPortalTempoCues({
        runtime: controller.runtime,
        journeyPathGuidance: hudViewModel.journeyPathGuidance,
        homeReadinessCue: hudViewModel.homeReadinessCue,
      }),
    [controller.runtime, hudViewModel.homeReadinessCue, hudViewModel.journeyPathGuidance],
  );
  const layerComposition = useMemo(
    () =>
      resolveWorldHubDecorationLayerComposition({
        homeLaneCelebrationProps,
        classCelebrationCues: classCelebration.cues,
        academyHomeCooldownCues: academyHomeCooldown.cues,
        academyPortalTempoCues: academyPortalTempo.cues,
        plazaSessionWrapUpCues: plazaWrapUp.cues,
        portalRidgeAnticipationCues: portalRidgeAnticipation.cues,
        portalExitReturnSoftnessCues: portalExitReturnSoftness.cues,
        sessionCelebrationAccents: sessionCelebration.accents,
        endOfDayQuietStateCues: endOfDayQuietState.cues,
        seasonal: seasonalDecorationState ?? {
          status: "fallback_preview",
          summary: {
            eyebrow: "Seasonal layer",
            title: "Fallback preview is active",
            detail: "Seasonal runtime inputs are not loaded yet.",
            chips: ["Fallback preview"],
          },
          layers: [],
          source: {
            kind: "local-preview-snapshot",
            label: "Deterministic local seasonal activation",
            detail: "Fallback while seasonal state resolves.",
            fallbackReason: "unavailable-config",
          },
          diagnostics: {
            adapterKind: "local-preview-snapshot",
            resolvedAtIso: new Date().toISOString(),
            matchedScheduleId: null,
            activeLayerCount: 0,
          },
        },
      }),
    [academyHomeCooldown.cues, academyPortalTempo.cues, classCelebration.cues, endOfDayQuietState.cues, homeLaneCelebrationProps, plazaWrapUp.cues, portalRidgeAnticipation.cues, portalExitReturnSoftness.cues, seasonalDecorationState, sessionCelebration.accents],
  );
  const emotionPresentation = useMemo(
    () =>
      resolveWorldHubEmotionPresentation({
        hasRuntime: Boolean(controller.runtime),
        homeLaneSignals: homeLanePersonalization.signals,
        homeLaneCelebrationProps: layerComposition.homeLaneCelebrationProps,
        homeRepeatVisitCue,
        homeReturnMemoryMarkers: homeReturnMemoryMarkerState.markers,
        classCelebrationCues: layerComposition.classCelebrationCues,
        sessionCelebrationAccents: layerComposition.sessionCelebrationAccents,
        plazaSessionWrapUpCues: layerComposition.plazaSessionWrapUpCues,
        academyHomeCooldownCues: layerComposition.academyHomeCooldownCues,
        academyPortalTempoCues: layerComposition.academyPortalTempoCues,
        endOfDayQuietStateCues: layerComposition.endOfDayQuietStateCues,
        portalRidgeAnticipationCues: layerComposition.portalRidgeAnticipationCues,
        portalExitReturnSoftnessCues: layerComposition.portalExitReturnSoftnessCues,
        nextAdventureSuggestion: hudViewModel.nextAdventureSuggestion,
        homeReadinessCue: hudViewModel.homeReadinessCue,
        journeyPathGuidance: hudViewModel.journeyPathGuidance,
        seasonalDecorationLayers: layerComposition.seasonalLayers,
        summaryChips: layerComposition.summaryChips,
      }),
    [controller.runtime, homeLanePersonalization.signals, layerComposition, homeRepeatVisitCue, homeReturnMemoryMarkerState.markers, hudViewModel.nextAdventureSuggestion, hudViewModel.homeReadinessCue, hudViewModel.journeyPathGuidance],
  );

  return (
    <section className="space-y-4">
      {controller.runtime && controller.player ? (
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),rgba(15,23,42,0.88)_42%,rgba(2,6,23,0.98)_100%)] shadow-[0_24px_100px_rgba(2,6,23,0.55)]">
          <ViewportGrid
            academyFocused={controller.kioskFocused}
            camera={controller.camera}
            emotionPresentation={emotionPresentation}
            focusedPortalId={controller.focusedPortal?.id ?? null}
            homeFocused={controller.homeFocused}
            onPortalSelect={controller.selectPortal}
            rendererMode={rendererMode}
            presentationProgression={presentationProgression}
            hintDensity={hintDensity}
            classSessionLaneAccents={classSessionLaneAccents}
            player={controller.player}
            runtime={controller.runtime}
            selectedPortalId={controller.selectedPortalId}
          />

          <WorldHubHud
            onStartAdventure={() => {
              if (!todaysAdventure) return;
              controller.selectPortal(todaysAdventure.id);
              void controller.joinSelectedPortal();
            }}
            portalEntryFeedback={controller.portalEntryFeedback}
            viewModel={hudViewModel}
            firstVisitOnboarding={firstVisitOnboarding.view}
            onDismissFirstVisitOnboarding={firstVisitOnboarding.dismiss}
            hintDensity={hintDensity}
            onOpenCodingStudio={() => {
              router.push(codingStudioAssignment ? "/edu/coding?entry=assignment" : "/edu/coding?entry=academy");
            }}
          />
        </div>
      ) : (
        <div className="grid min-h-[640px] gap-4 place-items-center rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),rgba(15,23,42,0.92)_42%,rgba(2,6,23,0.98)_100%)] px-6 text-center text-sm text-slate-300 shadow-[0_24px_100px_rgba(2,6,23,0.55)]">
          <div className="max-w-lg space-y-3 rounded-[28px] border border-white/10 bg-slate-950/45 p-6 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/75">Home</p>
            <h1 className="text-2xl font-semibold text-white">Your warm forest basecamp is loading</h1>
            <p>
              {controller.loading
                ? controller.statusText
                : controller.policy?.entry.detail ?? controller.errorText ?? "World hub unavailable."}
            </p>
            {!controller.loading ? (
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/60 hover:text-white"
                onClick={() => {
                  void controller.reload();
                }}
                type="button"
              >
                Retry local bootstrap
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{controller.runtime?.hud.runtimeBadge ?? "Preparing runtime"}</span>
          {selectedPortalPolicy?.detail ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{selectedPortalPolicy.detail}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controller.errorText ? <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-rose-100">{controller.errorText}</span> : null}
          {!controller.loading ? (
            <button
              className="rounded-full border border-white/15 px-4 py-2 text-slate-100 transition hover:border-cyan-300/60 hover:text-white"
              onClick={() => {
                void controller.reload();
              }}
              type="button"
            >
              Retry local bootstrap
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
