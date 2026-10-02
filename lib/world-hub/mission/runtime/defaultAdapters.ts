import type {
  MetaverseAssetDeliveryPort,
} from "@/lib/world-hub/assets/contracts";
import type {
  MissionRoomBootstrapPort,
  MissionRoomSceneConfigLoader,
} from "@/lib/world-hub/mission/contracts";
import type { MissionGameplayStatePort } from "@/lib/world-hub/mission/gameplay/contracts";
import type { MissionCompletionPort } from "@/lib/world-hub/mission/completion/contracts";
import { defaultMissionRoomAccessPolicy } from "@/lib/world-hub/policy/defaultAdapters";
import {
  createAuthoritativePresenceSubscription,
  createLocalNoopPresenceSubscription,
  type PresenceSubscriptionPort,
} from "@/lib/world-hub/runtime/sessionProjection";
import { localMissionRoomBootstrap } from "@/lib/world-hub/mission/bootstrap/localMission";
import { createWorkerBackedMissionRoomBootstrap } from "@/lib/world-hub/mission/bootstrap/workerRoom";
import { createDeterministicLocalMissionGameplayPort } from "@/lib/world-hub/mission/gameplay/localProgression";
import { createDeterministicLocalMissionCompletionPort } from "@/lib/world-hub/mission/completion/localCompletion";
import type { MetaverseMissionRewardHookPort } from "@/lib/world-hub/rewards/contracts";
import { createDeterministicLocalMissionRewardHookPort } from "@/lib/world-hub/rewards/localRewardHook";
import { createEdgeBackedMissionSceneConfigLoader } from "@/lib/world-hub/mission/manifest/edgeSceneConfig";
import { defaultMetaverseAssetDelivery } from "@/lib/world-hub/runtime/defaultAdapters";
import { createBrowserMetaverseProgressPersistence } from "@/lib/world-hub/progress/browserPersistence";
import {
  createLocalPreviewTeacherLiveSessionControlAdapter,
} from "@/lib/world-hub/classroom/liveSession/adapter";

function isWorkerBootstrapEnabled() {
  return process.env.NEXT_PUBLIC_WORLD_HUB_WORKER_BOOTSTRAP === "1";
}

export const defaultMissionRoomSceneConfigLoader: MissionRoomSceneConfigLoader =
  createEdgeBackedMissionSceneConfigLoader();

export const defaultMissionRoomAssetDelivery: MetaverseAssetDeliveryPort = defaultMetaverseAssetDelivery;

const workerBackedMissionRoomBootstrap = createWorkerBackedMissionRoomBootstrap({
  enabled: isWorkerBootstrapEnabled(),
});

export const defaultMissionRoomBootstrap: MissionRoomBootstrapPort = {
  async bootstrap(args) {
    switch (args.loadedSceneConfig.config.bootstrap.mode) {
      case "local-single-user":
        return localMissionRoomBootstrap.bootstrap(args);
      case "edge-room":
        return workerBackedMissionRoomBootstrap.bootstrap(args);
      default:
        throw new Error("Unknown mission bootstrap mode.");
    }
  },
};

export const defaultMissionRoomPresenceSubscription: PresenceSubscriptionPort = createAuthoritativePresenceSubscription({
  fallback: createLocalNoopPresenceSubscription(),
});

export const defaultMissionRoomGameplayState: MissionGameplayStatePort =
  createDeterministicLocalMissionGameplayPort();

export const defaultMissionRewardHook: MetaverseMissionRewardHookPort =
  createDeterministicLocalMissionRewardHookPort();

export { defaultMissionRoomAccessPolicy };

export const defaultMissionRoomCompletion: MissionCompletionPort =
  createDeterministicLocalMissionCompletionPort({ rewardHook: defaultMissionRewardHook });

export const defaultMissionProgressPersistence = createBrowserMetaverseProgressPersistence();
export const defaultMissionTeacherLiveSessionControls = createLocalPreviewTeacherLiveSessionControlAdapter();
