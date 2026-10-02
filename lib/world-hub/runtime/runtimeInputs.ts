import type {
  WorldHubLoadedManifest,
  WorldHubResolvedSessionBootstrap,
  WorldHubRuntimeInputs,
} from "@/lib/world-hub/contracts";
import { resolvePortalLaunchCues } from "@/lib/world-hub/runtime/launchPortalCues";
import type {
  AuthoritativeSessionProjection,
  PresenceSubscriptionSnapshot,
} from "@/lib/world-hub/runtime/sessionProjection";
import type { ResolvedTeacherLiveSessionSnapshot } from "@/lib/world-hub/classroom/liveSession/contracts";
import {
  createDeterministicLocalLiveSessionGuidance,
  projectMetaverseLiveSessionGuidance,
} from "@/lib/world-hub/classroom/liveSession/projection";

export function createWorldHubRuntimeInputs(args: {
  loadedManifest: WorldHubLoadedManifest;
  bootstrap: WorldHubResolvedSessionBootstrap;
  policy: import("@/lib/world-hub/policy/contracts").WorldHubResolvedAccessPolicy;
  session: AuthoritativeSessionProjection;
  presenceSubscription: PresenceSubscriptionSnapshot;
  assets: import("@/lib/world-hub/assets/contracts").WorldHubResolvedAssetSet;
  sceneLoading: import("@/lib/world-hub/assets/sceneLoading").WorldHubResolvedSceneLoading;
  progress: import("@/lib/world-hub/progress/contracts").MetaverseResolvedProgressSnapshot;
  launchControls: import("@/lib/world-hub/launch/contracts").MetaverseResolvedLaunchControlState;
  seasonalDecorations: import("@/lib/world-hub/seasonal/contracts").WorldHubResolvedSeasonalDecorationState;
  liveSessionSnapshot?: ResolvedTeacherLiveSessionSnapshot;
}): WorldHubRuntimeInputs {
  const { assets, sceneLoading, loadedManifest, bootstrap, policy, presenceSubscription, progress, session, launchControls, seasonalDecorations, liveSessionSnapshot } = args;
  const { manifest } = loadedManifest;
  const portals = resolvePortalLaunchCues({
    portals: manifest.portals,
    launchControls,
  });

  return {
    scene: {
      worldId: manifest.worldId,
      title: manifest.title,
      subtitle: manifest.subtitle,
      bounds: manifest.bounds,
    },
    manifestSource: loadedManifest.source,
    bootstrapSource: bootstrap.source,
    assets,
    sceneLoading,
    policy,
    hud: manifest.hud,
    spawn: manifest.spawn,
    kiosk: manifest.kiosk,
    portals,
    decorationAnchors: manifest.decorationAnchors,
    homeLane: manifest.homeLane,
    session: {
      requestedMode: bootstrap.requestedMode,
      mode: bootstrap.bootstrap.mode,
      authority: bootstrap.bootstrap.authority,
      sessionId: bootstrap.bootstrap.sessionId,
      shardLabel: bootstrap.bootstrap.shardLabel,
      occupancy: bootstrap.bootstrap.occupancy,
      reactionsEnabled: bootstrap.bootstrap.reactionsEnabled,
      projection: session,
    },
    presence: {
      nearbyPeers: bootstrap.bootstrap.nearbyPeers,
      subscription: presenceSubscription,
    },
    progress,
    launchControls,
    seasonalDecorations,
    liveSession: liveSessionSnapshot
      ? projectMetaverseLiveSessionGuidance(liveSessionSnapshot)
      : createDeterministicLocalLiveSessionGuidance(),
  };
}
