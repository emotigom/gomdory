"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MetaverseAssetDeliveryPort } from "@/lib/world-hub/assets/contracts";
import {
  createLoadingWorldHubSceneLoading,
  resolveWorldHubSceneLoading,
  type WorldHubResolvedSceneLoading,
} from "@/lib/world-hub/assets/sceneLoading";
import type { MetaverseLaunchControlPort } from "@/lib/world-hub/launch/contracts";
import {
  type WorldHubCameraState,
  type WorldHubLoadedManifest,
  type WorldHubManifestLoader,
  type WorldHubPlayerState,
  type WorldHubPortalHandoffPort,
  type WorldHubPortalManifest,
  type WorldHubResolvedSessionBootstrap,
  type WorldHubRuntimeInputs,
  type WorldHubSessionBootstrapPort,
} from "@/lib/world-hub/contracts";
import {
  getWorldHubMissionPolicyDecision,
  isWorldHubEntryBlocked,
  type WorldHubAccessPolicyPort,
  type WorldHubResolvedAccessPolicy,
} from "@/lib/world-hub/policy/contracts";
import {
  defaultMetaverseAssetDelivery,
  defaultMetaverseLaunchControlAdapter,
  defaultTeacherLiveSessionControls,
  defaultWorldHubAccessPolicy,
  defaultWorldHubManifestLoader,
  defaultWorldHubPortalHandoff,
  defaultWorldHubPresenceSubscription,
  defaultWorldHubProgressPersistence,
  defaultWorldHubSeasonalDecorationAdapter,
  defaultWorldHubSessionBootstrap,
} from "@/lib/world-hub/runtime/defaultAdapters";
import type { TeacherLiveSessionControlPort } from "@/lib/world-hub/classroom/liveSession/contracts";
import { resolveWorldHubNearbyContextualCue, type WorldHubNearbyContextualCue } from "@/lib/world-hub/runtime/contextualPrompts";
import { createWorldHubRuntimeInputs } from "@/lib/world-hub/runtime/runtimeInputs";
import {
  integrateWorldHubMovement,
  type WorldHubMovementInput,
  type WorldHubMovementVelocity,
} from "@/lib/world-hub/runtime/worldHubMovementController";
import {
  resolveWorldHubPortalEntryMicroFeedback,
  type WorldHubPortalEntryMicroFeedback,
} from "@/lib/world-hub/runtime/portalEntryMicroFeedback";
import type { MetaverseProgressPersistencePort } from "@/lib/world-hub/progress/contracts";
import {
  createAuthoritativeSessionProjection,
  type PresenceSubscriptionPort,
} from "@/lib/world-hub/runtime/sessionProjection";
import type { WorldHubSeasonalDecorationPort } from "@/lib/world-hub/seasonal/contracts";

type WorldHubControllerDeps = {
  manifestLoader: WorldHubManifestLoader;
  sessionBootstrap: WorldHubSessionBootstrapPort;
  accessPolicy: WorldHubAccessPolicyPort;
  presenceSubscription: PresenceSubscriptionPort;
  portalHandoff: WorldHubPortalHandoffPort;
  assetDelivery: MetaverseAssetDeliveryPort;
  progressPersistence: MetaverseProgressPersistencePort;
  launchControls: MetaverseLaunchControlPort;
  liveSessionControls: TeacherLiveSessionControlPort;
  seasonalDecorations: WorldHubSeasonalDecorationPort;
  navigateToMission: (route: string) => void;
  launchClassId: string | null;
};

type WorldHubControllerState = {
  loadedManifest: WorldHubLoadedManifest | null;
  bootstrap: WorldHubResolvedSessionBootstrap | null;
  policy: WorldHubResolvedAccessPolicy | null;
  launchControls: import("@/lib/world-hub/launch/contracts").MetaverseResolvedLaunchControlState | null;
  runtime: WorldHubRuntimeInputs | null;
  sceneLoading: WorldHubResolvedSceneLoading;
  player: WorldHubPlayerState | null;
  camera: WorldHubCameraState;
  loading: boolean;
  joiningPortalId: string | null;
  focusedPortal: WorldHubPortalManifest | null;
  nearbyCue: WorldHubNearbyContextualCue;
  homeFocused: boolean;
  kioskFocused: boolean;
  selectedPortalId: string | null;
  panelMode: "welcome" | "portal" | null;
  portalEntryFeedback: WorldHubPortalEntryMicroFeedback | null;
  statusText: string;
  errorText: string | null;
  moveByInput: (input: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  selectPortal: (portalId: string | null) => void;
  orbitCamera: (deltaDeg: number) => void;
  resetCamera: () => void;
  triggerInteract: () => Promise<void>;
  joinSelectedPortal: () => Promise<void>;
  reload: () => Promise<void>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useWorldHubController(
  deps: Partial<WorldHubControllerDeps> = {},
): WorldHubControllerState {
  const manifestLoader = useMemo<WorldHubManifestLoader>(
    () => deps.manifestLoader ?? defaultWorldHubManifestLoader,
    [deps.manifestLoader],
  );
  const sessionBootstrap = useMemo<WorldHubSessionBootstrapPort>(
    () => deps.sessionBootstrap ?? defaultWorldHubSessionBootstrap,
    [deps.sessionBootstrap],
  );
  const accessPolicy = useMemo<WorldHubAccessPolicyPort>(
    () => deps.accessPolicy ?? defaultWorldHubAccessPolicy,
    [deps.accessPolicy],
  );
  const presenceSubscription = useMemo<PresenceSubscriptionPort>(
    () => deps.presenceSubscription ?? defaultWorldHubPresenceSubscription,
    [deps.presenceSubscription],
  );
  const portalHandoff = useMemo<WorldHubPortalHandoffPort>(
    () => deps.portalHandoff ?? defaultWorldHubPortalHandoff,
    [deps.portalHandoff],
  );
  const assetDelivery = useMemo<MetaverseAssetDeliveryPort>(
    () => deps.assetDelivery ?? defaultMetaverseAssetDelivery,
    [deps.assetDelivery],
  );
  const progressPersistence = useMemo<MetaverseProgressPersistencePort>(
    () => deps.progressPersistence ?? defaultWorldHubProgressPersistence,
    [deps.progressPersistence],
  );
  const launchControls = useMemo<MetaverseLaunchControlPort>(
    () => deps.launchControls ?? defaultMetaverseLaunchControlAdapter,
    [deps.launchControls],
  );
  const liveSessionControls = useMemo<TeacherLiveSessionControlPort>(
    () => deps.liveSessionControls ?? defaultTeacherLiveSessionControls,
    [deps.liveSessionControls],
  );
  const seasonalDecorations = useMemo<WorldHubSeasonalDecorationPort>(
    () => deps.seasonalDecorations ?? defaultWorldHubSeasonalDecorationAdapter,
    [deps.seasonalDecorations],
  );

  const [loadedManifest, setLoadedManifest] = useState<WorldHubLoadedManifest | null>(null);
  const [bootstrap, setBootstrap] = useState<WorldHubResolvedSessionBootstrap | null>(null);
  const [policy, setPolicy] = useState<WorldHubResolvedAccessPolicy | null>(null);
  const [resolvedLaunchControls, setResolvedLaunchControls] = useState<import("@/lib/world-hub/launch/contracts").MetaverseResolvedLaunchControlState | null>(null);
  const [runtime, setRuntime] = useState<WorldHubRuntimeInputs | null>(null);
  const [sceneLoading, setSceneLoading] = useState<WorldHubResolvedSceneLoading>(
    createLoadingWorldHubSceneLoading({ worldId: "world-hub" }),
  );
  const [player, setPlayer] = useState<WorldHubPlayerState | null>(null);
  const [camera, setCamera] = useState<WorldHubCameraState>({ orbitDeg: 18, distance: 1, followLag: 0.18 });
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Loading hub manifest…");
  const [joiningPortalId, setJoiningPortalId] = useState<string | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"welcome" | "portal" | null>("welcome");
  const [portalEntryFeedback, setPortalEntryFeedback] = useState<WorldHubPortalEntryMicroFeedback | null>(null);
  const bootIdRef = useRef(0);
  const movementInputRef = useRef<WorldHubMovementInput>({ up: false, down: false, left: false, right: false });
  const movementVelocityRef = useRef<WorldHubMovementVelocity>({ x: 0, y: 0 });
  const playerRef = useRef<WorldHubPlayerState | null>(null);

  const navigateRef = useRef(deps.navigateToMission);
  navigateRef.current = deps.navigateToMission;

  const reload = useCallback(async () => {
    const bootId = bootIdRef.current + 1;
    bootIdRef.current = bootId;

    try {
      setLoading(true);
      setErrorText(null);
      setLoadedManifest(null);
      setBootstrap(null);
      setPolicy(null);
      setResolvedLaunchControls(null);
      setRuntime(null);
      setSceneLoading(createLoadingWorldHubSceneLoading({ worldId: "world-hub" }));
      setSelectedPortalId(null);
      setPanelMode("welcome");
      setPortalEntryFeedback(null);
      setStatusText("Loading hub manifest…");

      const nextLoadedManifest = await manifestLoader.loadInitialManifest();
      if (bootIdRef.current !== bootId) return;

      setLoadedManifest(nextLoadedManifest);
      setSceneLoading(createLoadingWorldHubSceneLoading({ worldId: nextLoadedManifest.manifest.worldId }));

      setStatusText("Resolving launch controls…");
      const nextLaunchControls = await launchControls.resolveLaunchControls({
        context: {
          classId: deps.launchClassId ?? null,
          worldId: nextLoadedManifest.manifest.worldId,
          sessionId:
            nextLoadedManifest.manifest.bootstrap.mode === "local-single-user"
              ? nextLoadedManifest.manifest.bootstrap.sessionId
              : null,
        },
      });
      if (bootIdRef.current !== bootId) return;

      setResolvedLaunchControls(nextLaunchControls);

      setStatusText("Resolving classroom access policy…");
      const nextPolicy = await accessPolicy.resolvePolicy(nextLoadedManifest.manifest);
      if (bootIdRef.current !== bootId) return;

      setPolicy(nextPolicy);
      if (isWorldHubEntryBlocked(nextPolicy)) {
        setStatusText(nextPolicy.entry.label);
        setLoading(false);
        return;
      }

      setPlayer({
        position: nextLoadedManifest.manifest.spawn.position,
        heading: nextLoadedManifest.manifest.spawn.heading,
        speed: nextLoadedManifest.manifest.spawn.speed,
        activePortalId: null,
      });
      movementInputRef.current = { up: false, down: false, left: false, right: false };
      movementVelocityRef.current = { x: 0, y: 0 };

      setStatusText("Resolving asset manifest…");
      const nextAssets = await assetDelivery.loadWorldHubAssets({
        worldId: nextLoadedManifest.manifest.worldId,
      });
      const nextSceneLoading = resolveWorldHubSceneLoading(nextAssets);
      if (bootIdRef.current !== bootId) return;

      setSceneLoading(nextSceneLoading);
      setStatusText(`Bootstrapping ${nextLoadedManifest.manifest.bootstrap.mode} session…`);
      const nextBootstrap = await sessionBootstrap.bootstrap(nextLoadedManifest.manifest);
      if (bootIdRef.current !== bootId) return;

      const projectedSession = createAuthoritativeSessionProjection({
        scope: "world-hub",
        runtimeId: nextBootstrap.bootstrap.sessionId,
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
          scope: "world-hub",
          classId: deps.launchClassId ?? null,
          worldId: nextLoadedManifest.manifest.worldId,
          missionId: null,
          sessionId: nextBootstrap.bootstrap.sessionId,
        },
      });
      if (bootIdRef.current !== bootId) return;
      const seasonalDecorationState = await seasonalDecorations.resolveState({
        context: {
          classId: deps.launchClassId ?? null,
          worldId: nextLoadedManifest.manifest.worldId,
          sessionId: nextBootstrap.bootstrap.sessionId,
        },
      });
      if (bootIdRef.current !== bootId) return;

      setStatusText("Loading persisted metaverse progress…");
      const nextProgress = await progressPersistence.readSnapshot();
      if (bootIdRef.current !== bootId) return;

      setBootstrap(nextBootstrap);
      const nextRuntime = createWorldHubRuntimeInputs({
        loadedManifest: nextLoadedManifest,
        bootstrap: nextBootstrap,
        session: projectedSession,
        presenceSubscription: nextPresenceSubscription,
        assets: nextAssets,
        sceneLoading: nextSceneLoading,
        policy: nextPolicy,
        progress: nextProgress,
        launchControls: nextLaunchControls,
        seasonalDecorations: seasonalDecorationState,
        liveSessionSnapshot,
      });
      setRuntime(nextRuntime);
      setStatusText(`Hub ready from ${nextRuntime.manifestSource.label}. Move with WASD / arrows, press E near home, the academy post, or a trail gate.`);
    } catch (error) {
      if (bootIdRef.current !== bootId) return;
      setErrorText(error instanceof Error ? error.message : "Failed to boot world hub");
      setStatusText("World hub bootstrap failed. Retry the local preview loader.");
    } finally {
      if (bootIdRef.current === bootId) {
        setLoading(false);
      }
    }
  }, [accessPolicy, assetDelivery, deps.launchClassId, launchControls, liveSessionControls, manifestLoader, presenceSubscription, progressPersistence, seasonalDecorations, sessionBootstrap]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (!portalEntryFeedback) return;
    const timeout = window.setTimeout(() => {
      setPortalEntryFeedback((current) => (current?.id === portalEntryFeedback.id ? null : current));
    }, portalEntryFeedback.expiresAfterMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [portalEntryFeedback]);

  useEffect(() => {
    if (!runtime) return;

    let frameId = 0;
    let previousNow = 0;

    const tick = (now: number) => {
      if (previousNow === 0) {
        previousNow = now;
      }

      const deltaSeconds = clamp((now - previousNow) / 1_000, 0, 0.05);
      previousNow = now;

      setPlayer((current) => {
        if (!current) return current;

        const integration = integrateWorldHubMovement({
          player: current,
          velocity: movementVelocityRef.current,
          input: movementInputRef.current,
          bounds: runtime.scene.bounds,
          deltaSeconds,
        });
        movementVelocityRef.current = integration.velocity;

        if (
          current.position.x === integration.player.position.x &&
          current.position.y === integration.player.position.y &&
          current.heading === integration.player.heading &&
          current.speed === integration.player.speed
        ) {
          return current;
        }

        return integration.player;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    if (playerRef.current) {
      frameId = window.requestAnimationFrame(tick);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [runtime]);

  const nearbyCue = useMemo(() => {
    if (!runtime || !player) return null;
    return resolveWorldHubNearbyContextualCue({
      runtime,
      playerPosition: player.position,
      selectedPortalId,
    });
  }, [runtime, player, selectedPortalId]);

  const focusedPortal = useMemo(() => {
    if (nearbyCue?.kind !== "portal") return null;
    return nearbyCue.portal;
  }, [nearbyCue]);

  const homeFocused = nearbyCue?.kind === "home";
  const kioskFocused = nearbyCue?.kind === "academy";

  useEffect(() => {
    setPlayer((current) => {
      if (!current) return current;
      return {
        ...current,
        activePortalId: focusedPortal?.id ?? null,
      };
    });
  }, [focusedPortal?.id]);

  const moveByInput = useCallback((input: { up: boolean; down: boolean; left: boolean; right: boolean }) => {
    movementInputRef.current = input;
  }, []);

  const selectPortal = useCallback((portalId: string | null) => {
    setSelectedPortalId(portalId);
    setPanelMode(portalId ? "portal" : null);
    setStatusText(portalId ? "Trail marker selected. Press Enter when you are ready." : "Trail selection cleared.");
  }, []);

  const orbitCamera = useCallback((deltaDeg: number) => {
    setCamera((current) => ({
      ...current,
      orbitDeg: clamp(current.orbitDeg + deltaDeg, -40, 40),
    }));
  }, []);

  const resetCamera = useCallback(() => {
    setCamera({ orbitDeg: 18, distance: 1, followLag: 0.18 });
    setStatusText("Camera reset to your usual camp view.");
  }, []);

  const triggerInteract = useCallback(async () => {
    if (focusedPortal) {
      setSelectedPortalId(focusedPortal.id);
      setPanelMode("portal");
      setStatusText(`Trail gate ready: ${focusedPortal.label}`);
      return;
    }

    if (homeFocused) {
      setSelectedPortalId(null);
      setPanelMode("welcome");
      setStatusText("You are back at your home fire. Take a breath, then choose a trail when you are ready.");
      return;
    }

    if (kioskFocused) {
      setSelectedPortalId(null);
      setPanelMode("welcome");
      setStatusText("Academy post ready. Check the guide note when you want a gentle nudge.");
      return;
    }

    setStatusText("Move closer to home, the academy post, or a trail gate to interact.");
  }, [focusedPortal, homeFocused, kioskFocused]);

  const joinSelectedPortal = useCallback(async () => {
    if (!loadedManifest || !player || !runtime || !policy) {
      setStatusText("Basecamp is still settling in.");
      return;
    }

    const targetPortal =
      focusedPortal ??
      (selectedPortalId ? runtime.portals.find((portal) => portal.id === selectedPortalId) ?? null : null);

    if (!targetPortal) {
      setStatusText("Step up to a trail gate before setting out.");
      return;
    }

    const missionDecision = getWorldHubMissionPolicyDecision({ policy, missionId: targetPortal.id });
    if (targetPortal.entryCue === "unavailable") {
      setPortalEntryFeedback(
        resolveWorldHubPortalEntryMicroFeedback({
          event: {
            kind: "unavailable",
            portalId: targetPortal.id,
            portalLabel: targetPortal.label,
            detail: targetPortal.summary,
          },
          portal: targetPortal,
        }),
      );
      setStatusText(targetPortal.summary);
      return;
    }
    if (missionDecision?.status === "blocked") {
      setPortalEntryFeedback(
        resolveWorldHubPortalEntryMicroFeedback({
          event: {
            kind: "blocked",
            portalId: targetPortal.id,
            portalLabel: targetPortal.label,
            detail: missionDecision.detail ?? null,
          },
          portal: targetPortal,
        }),
      );
      setStatusText(missionDecision.detail ?? missionDecision.label);
      return;
    }

    setPortalEntryFeedback(
      resolveWorldHubPortalEntryMicroFeedback({
        event: {
          kind: "launching",
          portalId: targetPortal.id,
          portalLabel: targetPortal.label,
        },
        portal: targetPortal,
      }),
    );
    setJoiningPortalId(targetPortal.id);
    setStatusText(`Opening ${targetPortal.label}…`);

    try {
      const result = await portalHandoff.handoff({
        worldId: loadedManifest.manifest.worldId,
        portal: targetPortal,
        session: {
          sessionId: runtime.session.sessionId,
          authority: runtime.session.authority,
          shardLabel: runtime.session.shardLabel,
        },
      });

      setPortalEntryFeedback(
        resolveWorldHubPortalEntryMicroFeedback({
          event: {
            kind: "handoff-ready",
            portalId: targetPortal.id,
            portalLabel: targetPortal.label,
            launchMode: result.launchMode,
          },
          portal: targetPortal,
        }),
      );
      setStatusText(`Trail handoff ready via ${result.launchMode}. Heading out…`);
      navigateRef.current?.(result.missionRoute);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Trail handoff failed.";
      setPortalEntryFeedback(
        resolveWorldHubPortalEntryMicroFeedback({
          event: {
            kind: "handoff-failed",
            portalId: targetPortal.id,
            portalLabel: targetPortal.label,
            detail,
          },
          portal: targetPortal,
        }),
      );
      setStatusText(detail);
    } finally {
      setJoiningPortalId(null);
    }
  }, [focusedPortal, loadedManifest, player, policy, portalHandoff, runtime, selectedPortalId]);

  return {
    loadedManifest,
    bootstrap,
    policy,
    launchControls: resolvedLaunchControls,
    runtime,
    sceneLoading,
    player,
    camera,
    loading,
    joiningPortalId,
    focusedPortal,
    nearbyCue,
    homeFocused,
    kioskFocused,
    selectedPortalId,
    panelMode,
    portalEntryFeedback,
    statusText,
    errorText,
    moveByInput,
    selectPortal,
    orbitCamera,
    resetCamera,
    triggerInteract,
    joinSelectedPortal,
    reload,
  };
}
