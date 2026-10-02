"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MetaverseAssetDeliveryPort } from "@/lib/world-hub/assets/contracts";
import {
  createLoadingMissionRoomSceneLoading,
  resolveMissionRoomSceneLoading,
  type MissionRoomResolvedSceneLoading,
} from "@/lib/world-hub/assets/sceneLoading";
import type {
  MissionRoomBootstrapPort,
  MissionRoomResolvedBootstrap,
  MissionRoomLoadedSceneConfig,
  MissionRoomRouteSeed,
  MissionRoomRuntimeInputs,
  MissionRoomSceneConfigLoader,
} from "@/lib/world-hub/mission/contracts";
import type { MissionCompletionPort, MissionCompletionResolvedState } from "@/lib/world-hub/mission/completion/contracts";
import type { MissionGameplayStatePort } from "@/lib/world-hub/mission/gameplay/contracts";
import type { MetaverseProgressPersistencePort } from "@/lib/world-hub/progress/contracts";
import type { TeacherLiveSessionControlPort } from "@/lib/world-hub/classroom/liveSession/contracts";
import {
  isMissionRoomEntryBlocked,
  type MissionRoomAccessPolicyPort,
  type MissionRoomResolvedAccessPolicy,
} from "@/lib/world-hub/policy/contracts";
import {
  defaultMissionRoomAccessPolicy,
  defaultMissionRoomAssetDelivery,
  defaultMissionRoomBootstrap,
  defaultMissionRoomCompletion,
  defaultMissionRoomGameplayState,
  defaultMissionRoomPresenceSubscription,
  defaultMissionProgressPersistence,
  defaultMissionRoomSceneConfigLoader,
  defaultMissionTeacherLiveSessionControls,
} from "@/lib/world-hub/mission/runtime/defaultAdapters";
import {
  createWorldHubMissionResultReturnPayload,
  createWorldHubReturnRouteWithMissionResult,
  withWorldHubMissionResultPersistenceStatus,
} from "@/lib/world-hub/mission/resultHandoff";
import { createMissionRoomRuntimeInputs } from "@/lib/world-hub/mission/runtime/runtimeInputs";
import {
  createAuthoritativeSessionProjection,
  type PresenceSubscriptionPort,
} from "@/lib/world-hub/runtime/sessionProjection";

type MissionRoomControllerDeps = {
  routeSeed: MissionRoomRouteSeed;
  sceneConfigLoader?: MissionRoomSceneConfigLoader;
  bootstrap?: MissionRoomBootstrapPort;
  gameplayState?: MissionGameplayStatePort;
  completion?: MissionCompletionPort;
  accessPolicy?: MissionRoomAccessPolicyPort;
  presenceSubscription?: PresenceSubscriptionPort;
  assetDelivery?: MetaverseAssetDeliveryPort;
  progressPersistence?: MetaverseProgressPersistencePort;
  liveSessionControls?: TeacherLiveSessionControlPort;
  navigateToHub?: (route: string) => void;
};

type MissionRoomControllerState = {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig | null;
  bootstrap: MissionRoomResolvedBootstrap | null;
  policy: MissionRoomResolvedAccessPolicy | null;
  completion: MissionCompletionResolvedState | null;
  runtime: MissionRoomRuntimeInputs | null;
  sceneLoading: MissionRoomResolvedSceneLoading;
  loading: boolean;
  errorText: string | null;
  statusText: string;
  reload: () => Promise<void>;
  advanceObjective: () => Promise<void>;
  advancingObjective: boolean;
  returningToHub: boolean;
  returnToHub: () => Promise<void>;
};

export function useMissionRoomController(
  deps: MissionRoomControllerDeps,
): MissionRoomControllerState {
  const sceneConfigLoader = useMemo<MissionRoomSceneConfigLoader>(
    () => deps.sceneConfigLoader ?? defaultMissionRoomSceneConfigLoader,
    [deps.sceneConfigLoader],
  );
  const bootstrap = useMemo<MissionRoomBootstrapPort>(
    () => deps.bootstrap ?? defaultMissionRoomBootstrap,
    [deps.bootstrap],
  );
  const gameplayState = useMemo<MissionGameplayStatePort>(
    () => deps.gameplayState ?? defaultMissionRoomGameplayState,
    [deps.gameplayState],
  );
  const completion = useMemo<MissionCompletionPort>(
    () => deps.completion ?? defaultMissionRoomCompletion,
    [deps.completion],
  );
  const accessPolicy = useMemo<MissionRoomAccessPolicyPort>(
    () => deps.accessPolicy ?? defaultMissionRoomAccessPolicy,
    [deps.accessPolicy],
  );
  const presenceSubscription = useMemo<PresenceSubscriptionPort>(
    () => deps.presenceSubscription ?? defaultMissionRoomPresenceSubscription,
    [deps.presenceSubscription],
  );
  const assetDelivery = useMemo<MetaverseAssetDeliveryPort>(
    () => deps.assetDelivery ?? defaultMissionRoomAssetDelivery,
    [deps.assetDelivery],
  );
  const progressPersistence = useMemo<MetaverseProgressPersistencePort>(
    () => deps.progressPersistence ?? defaultMissionProgressPersistence,
    [deps.progressPersistence],
  );
  const liveSessionControls = useMemo<TeacherLiveSessionControlPort>(
    () => deps.liveSessionControls ?? defaultMissionTeacherLiveSessionControls,
    [deps.liveSessionControls],
  );

  const [loadedSceneConfig, setLoadedSceneConfig] = useState<MissionRoomLoadedSceneConfig | null>(null);
  const [bootState, setBootState] = useState<MissionRoomResolvedBootstrap | null>(null);
  const [policy, setPolicy] = useState<MissionRoomResolvedAccessPolicy | null>(null);
  const [resolvedCompletion, setResolvedCompletion] = useState<MissionCompletionResolvedState | null>(null);
  const [runtime, setRuntime] = useState<MissionRoomRuntimeInputs | null>(null);
  const [sceneLoading, setSceneLoading] = useState<MissionRoomResolvedSceneLoading>(
    createLoadingMissionRoomSceneLoading({ missionId: deps.routeSeed.missionId }),
  );
  const [loading, setLoading] = useState(true);
  const [advancingObjective, setAdvancingObjective] = useState(false);
  const [returningToHub, setReturningToHub] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Loading mission scene config…");
  const bootIdRef = useRef(0);
  const navigateToHubRef = useRef(deps.navigateToHub);
  navigateToHubRef.current = deps.navigateToHub;

  const reload = useCallback(async () => {
    const bootId = bootIdRef.current + 1;
    bootIdRef.current = bootId;

    try {
      setLoading(true);
      setAdvancingObjective(false);
      setReturningToHub(false);
      setErrorText(null);
      setLoadedSceneConfig(null);
      setBootState(null);
      setPolicy(null);
      setResolvedCompletion(null);
      setRuntime(null);
      setSceneLoading(createLoadingMissionRoomSceneLoading({ missionId: deps.routeSeed.missionId }));
      setStatusText("Loading mission scene config…");

      const nextLoadedSceneConfig = await sceneConfigLoader.loadInitialSceneConfig(deps.routeSeed);
      if (bootIdRef.current !== bootId) return;

      setLoadedSceneConfig(nextLoadedSceneConfig);

      setStatusText("Resolving classroom access policy…");
      const nextPolicy = await accessPolicy.resolvePolicy({
        routeSeed: deps.routeSeed,
        loadedSceneConfig: nextLoadedSceneConfig,
      });
      if (bootIdRef.current !== bootId) return;

      setPolicy(nextPolicy);
      if (isMissionRoomEntryBlocked(nextPolicy)) {
        setStatusText(nextPolicy.entry.label);
        setLoading(false);
        return;
      }

      setStatusText("Resolving mission asset manifest…");

      const nextAssets = await assetDelivery.loadMissionRoomAssets({
        missionId: nextLoadedSceneConfig.config.missionId,
      });
      const nextSceneLoading = resolveMissionRoomSceneLoading(nextAssets);
      if (bootIdRef.current !== bootId) return;

      setSceneLoading(nextSceneLoading);
      setStatusText(`Bootstrapping ${nextLoadedSceneConfig.config.bootstrap.mode} mission room…`);

      const nextBootstrap = await bootstrap.bootstrap({
        routeSeed: deps.routeSeed,
        loadedSceneConfig: nextLoadedSceneConfig,
      });
      if (bootIdRef.current !== bootId) return;

      const projectedSession = createAuthoritativeSessionProjection({
        scope: "mission-room",
        runtimeId: nextBootstrap.bootstrap.roomId,
        runtimeAuthority: nextBootstrap.bootstrap.authority,
        metadata: nextBootstrap.bootstrap.metadata,
      });
      const nextPresenceSubscription = await presenceSubscription.subscribe({
        session: projectedSession,
        authorityPresence: nextBootstrap.bootstrap.presenceSnapshot,
      });
      if (bootIdRef.current !== bootId) return;
      const liveSessionSnapshot = await liveSessionControls.resolveSnapshot({
        context: {
          scope: "mission-room",
          classId: null,
          worldId: deps.routeSeed.mode === "validated-handoff" ? deps.routeSeed.handoff.worldId : null,
          missionId: deps.routeSeed.missionId,
          sessionId:
            deps.routeSeed.mode === "validated-handoff"
              ? deps.routeSeed.handoff.sessionId
              : nextBootstrap.bootstrap.roomId,
        },
      });
      if (bootIdRef.current !== bootId) return;

      setStatusText("Resolving gameplay objective state…");
      const nextGameplay = await gameplayState.resolveInitialState({
        routeSeed: deps.routeSeed,
        loadedSceneConfig: nextLoadedSceneConfig,
        bootstrap: nextBootstrap,
        session: projectedSession,
        policy: nextPolicy,
      });
      if (bootIdRef.current !== bootId) return;

      setStatusText("Resolving mission completion seam…");
      const nextCompletion = await completion.resolveInitialResult({
        routeSeed: deps.routeSeed,
        loadedSceneConfig: nextLoadedSceneConfig,
        bootstrap: nextBootstrap,
        session: projectedSession,
        policy: nextPolicy,
        gameplay: nextGameplay,
      });
      if (bootIdRef.current !== bootId) return;

      setBootState(nextBootstrap);
      setResolvedCompletion(nextCompletion);
      const nextRuntime = createMissionRoomRuntimeInputs({
        routeSeed: deps.routeSeed,
        loadedSceneConfig: nextLoadedSceneConfig,
        bootstrap: nextBootstrap,
        session: projectedSession,
        presenceSubscription: nextPresenceSubscription,
        assets: nextAssets,
        sceneLoading: nextSceneLoading,
        policy: nextPolicy,
        gameplay: nextGameplay,
        completion: nextCompletion,
        liveSessionSnapshot,
      });
      setRuntime(nextRuntime);
      setStatusText(
        nextCompletion.outcome.status === "completed"
          ? `Mission completion preview ready from ${nextCompletion.source.label}.`
          : deps.routeSeed.mode === "validated-handoff"
            ? `Mission runtime ready from ${nextRuntime.source.label}.`
            : `Mission fallback runtime ready from ${nextRuntime.source.label}.`,
      );
    } catch (error) {
      if (bootIdRef.current !== bootId) return;
      setErrorText(error instanceof Error ? error.message : "Failed to boot mission room");
      setStatusText("Mission room bootstrap failed. Retry the local runtime.");
    } finally {
      if (bootIdRef.current === bootId) {
        setLoading(false);
      }
    }
  }, [accessPolicy, assetDelivery, bootstrap, completion, deps.routeSeed, gameplayState, liveSessionControls, presenceSubscription, sceneConfigLoader]);

  const advanceObjective = useCallback(async () => {
    if (!runtime || !loadedSceneConfig || !bootState || !policy) {
      return;
    }

    try {
      setAdvancingObjective(true);
      setErrorText(null);
      setStatusText("Advancing local mission objective…");

      const nextGameplay = await gameplayState.advance({
        current: runtime.gameplay,
        routeSeed: deps.routeSeed,
        loadedSceneConfig,
        bootstrap: bootState,
        session: runtime.session,
        policy,
      });

      const nextCompletion = await completion.syncResolvedResult({
        current: runtime.completion,
        routeSeed: deps.routeSeed,
        loadedSceneConfig,
        bootstrap: bootState,
        session: runtime.session,
        policy,
        gameplay: nextGameplay,
      });

      const nextRuntime = {
        ...runtime,
        gameplay: nextGameplay,
        completion: nextCompletion,
      };

      setResolvedCompletion(nextCompletion);
      setRuntime(nextRuntime);
      setStatusText(
        nextCompletion.outcome.status === "completed"
          ? "Mission completion placeholder resolved locally."
          : `Mission objective advanced: ${nextGameplay.progress.statusLabel}.`,
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to advance mission objective");
      setStatusText("Mission objective update failed. Retry the local progression stub.");
    } finally {
      setAdvancingObjective(false);
    }
  }, [bootState, completion, deps.routeSeed, gameplayState, loadedSceneConfig, policy, runtime]);

  const returnToHub = useCallback(async () => {
    if (!runtime) {
      setStatusText("Mission runtime is still loading.");
      return;
    }

    if (runtime.completion.outcome.status !== "completed") {
      setStatusText("Complete the mission before returning a result to the hub.");
      return;
    }

    try {
      setReturningToHub(true);
      setErrorText(null);
      setStatusText("Packaging mission result handoff for the world hub…");

      const payload = createWorldHubMissionResultReturnPayload({
        runtime,
      });
      const writeResult = await progressPersistence.persistCompletion({ payload });
      const payloadWithPersistence = withWorldHubMissionResultPersistenceStatus(
        payload,
        writeResult.status === "persisted"
          ? "persisted"
          : writeResult.status === "fallback-persisted"
            ? "fallback-local"
            : "not-connected",
      );
      const returnRoute = createWorldHubReturnRouteWithMissionResult({
        hubPath: runtime.route.returnHubPath,
        payload: payloadWithPersistence,
      });

      setStatusText(
        writeResult.status === "persisted"
          ? "Mission result saved. Returning to world hub…"
          : writeResult.status === "fallback-persisted"
            ? "Mission result saved locally. Returning to world hub…"
            : "Mission result handoff ready without persistence. Returning to world hub…",
      );
      navigateToHubRef.current?.(returnRoute);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to prepare mission result handoff");
      setStatusText("Mission result handoff failed. Retry the return flow.");
    } finally {
      setReturningToHub(false);
    }
  }, [progressPersistence, runtime]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    routeSeed: deps.routeSeed,
    loadedSceneConfig,
    bootstrap: bootState,
    policy,
    completion: resolvedCompletion,
    runtime,
    sceneLoading,
    loading,
    errorText,
    statusText,
    reload,
    advanceObjective,
    advancingObjective,
    returningToHub,
    returnToHub,
  };
}
