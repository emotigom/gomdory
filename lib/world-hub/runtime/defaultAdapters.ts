import type {
  MetaverseAssetDeliveryPort,
} from "@/lib/world-hub/assets/contracts";
import { createR2BackedMetaverseAssetDelivery } from "@/lib/world-hub/assets/r2AssetDelivery";
import type { WorldHubPortalHandoffPort, WorldHubSessionBootstrapPort } from "@/lib/world-hub/contracts";
import { defaultWorldHubAccessPolicy } from "@/lib/world-hub/policy/defaultAdapters";
import {
  createAuthoritativePresenceSubscription,
  createLocalNoopPresenceSubscription,
  type PresenceSubscriptionPort,
} from "@/lib/world-hub/runtime/sessionProjection";
import { localSingleUserWorldHubSessionBootstrap } from "@/lib/world-hub/bootstrap/localSingleUser";
import { createWorkerBackedWorldHubSessionBootstrap } from "@/lib/world-hub/bootstrap/workerSession";
import {
  createMissionRouteWithHandoff,
  createWorldHubMissionHandoffPayload,
} from "@/lib/world-hub/mission/handoff";
import { createEdgeBackedWorldHubManifestLoader } from "@/lib/world-hub/manifest/edgeManifest";
import { createBrowserMetaverseProgressPersistence } from "@/lib/world-hub/progress/browserPersistence";
import { defaultMetaverseLaunchControlAdapter } from "@/lib/world-hub/launch/adapter";
import {
  createLocalPreviewTeacherLiveSessionControlAdapter,
} from "@/lib/world-hub/classroom/liveSession/adapter";
import { defaultWorldHubSeasonalDecorationAdapter } from "@/lib/world-hub/seasonal/adapter";

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isWorkerBootstrapEnabled() {
  return process.env.NEXT_PUBLIC_WORLD_HUB_WORKER_BOOTSTRAP === "1";
}

function isRemoteAssetDeliveryEnabled() {
  return process.env.NEXT_PUBLIC_WORLD_HUB_ASSET_DELIVERY === "r2";
}

function getRemoteAssetBaseUrl() {
  return process.env.NEXT_PUBLIC_WORLD_HUB_ASSET_BASE_URL?.trim() || null;
}

export const defaultWorldHubManifestLoader = createEdgeBackedWorldHubManifestLoader();

export const defaultMetaverseAssetDelivery: MetaverseAssetDeliveryPort = createR2BackedMetaverseAssetDelivery({
  enabled: isRemoteAssetDeliveryEnabled(),
  publicBaseUrl: getRemoteAssetBaseUrl(),
});

const workerBackedWorldHubSessionBootstrap = createWorkerBackedWorldHubSessionBootstrap({
  enabled: isWorkerBootstrapEnabled(),
});

export const defaultWorldHubSessionBootstrap: WorldHubSessionBootstrapPort = {
  async bootstrap(manifest) {
    switch (manifest.bootstrap.mode) {
      case "local-single-user":
        return localSingleUserWorldHubSessionBootstrap.bootstrap(manifest);
      case "edge-session":
        return workerBackedWorldHubSessionBootstrap.bootstrap(manifest);
      default:
        throw new Error("Unknown world hub bootstrap mode.");
    }
  },
};

export const defaultWorldHubPortalHandoff: WorldHubPortalHandoffPort = {
  async handoff({ portal, session, worldId }) {
    await delay(250);

    const handoff = createWorldHubMissionHandoffPayload({
      worldId,
      sessionId: session.sessionId,
      portal,
      launchMode: "placeholder-route",
      bootstrapMode: session.authority === "edge-worker" ? "edge-bootstrap" : "local-preview",
    });

    return {
      missionRoute: createMissionRouteWithHandoff({
        missionRoute: portal.missionRoute,
        handoff,
      }),
      launchMode: "placeholder-route",
      handoff,
    };
  },
};

export const defaultWorldHubPresenceSubscription: PresenceSubscriptionPort = createAuthoritativePresenceSubscription({
  fallback: createLocalNoopPresenceSubscription(),
});

export { defaultWorldHubAccessPolicy, defaultMetaverseLaunchControlAdapter };
export const defaultTeacherLiveSessionControls = createLocalPreviewTeacherLiveSessionControlAdapter();
export { defaultWorldHubSeasonalDecorationAdapter };

export const defaultWorldHubProgressPersistence = createBrowserMetaverseProgressPersistence();
