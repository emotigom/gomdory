import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomResolvedBootstrap,
  MissionRoomRouteSeed,
  MissionRoomRuntimeInputs,
} from "@/lib/world-hub/mission/contracts";
import type {
  AuthoritativeSessionProjection,
  PresenceSubscriptionSnapshot,
} from "@/lib/world-hub/runtime/sessionProjection";
import type { ResolvedTeacherLiveSessionSnapshot } from "@/lib/world-hub/classroom/liveSession/contracts";
import {
  createDeterministicLocalLiveSessionGuidance,
  projectMetaverseLiveSessionGuidance,
} from "@/lib/world-hub/classroom/liveSession/projection";

export function createMissionRoomRuntimeInputs(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
  bootstrap: MissionRoomResolvedBootstrap;
  policy: import("@/lib/world-hub/policy/contracts").MissionRoomResolvedAccessPolicy;
  session: AuthoritativeSessionProjection;
  presenceSubscription: PresenceSubscriptionSnapshot;
  assets: import("@/lib/world-hub/assets/contracts").MissionRoomResolvedAssetSet;
  sceneLoading: import("@/lib/world-hub/assets/sceneLoading").MissionRoomResolvedSceneLoading;
  gameplay: import("@/lib/world-hub/mission/gameplay/contracts").MissionGameplayState;
  completion: import("@/lib/world-hub/mission/completion/contracts").MissionCompletionResolvedState;
  liveSessionSnapshot?: ResolvedTeacherLiveSessionSnapshot;
}): MissionRoomRuntimeInputs {
  const { assets, sceneLoading, completion, gameplay, routeSeed, loadedSceneConfig, bootstrap, policy, presenceSubscription, session, liveSessionSnapshot } = args;
  const { config, source } = loadedSceneConfig;

  return {
    route: {
      missionId: routeSeed.missionId,
      mode: routeSeed.mode,
      returnHubPath: routeSeed.returnHubPath,
      fallbackReason: routeSeed.mode === "local-fallback" ? routeSeed.fallbackReason : null,
    },
    handoff: {
      missionId: routeSeed.missionId,
      worldId: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.worldId : null,
      sessionId: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.sessionId : null,
      launchMode: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.launchMode : "local-fallback",
      bootstrapMode: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.bootstrapMode : "local-fallback",
      issuedAtIso: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.issuedAtIso : null,
      portalLabel:
        routeSeed.mode === "validated-handoff" ? routeSeed.handoff.portal.label : routeSeed.portal?.label ?? routeSeed.missionId,
      portalStatusLabel:
        routeSeed.mode === "validated-handoff" ? routeSeed.handoff.portal.statusLabel : routeSeed.portal?.statusLabel ?? "Fallback only",
      portalAvailability:
        routeSeed.mode === "validated-handoff" ? routeSeed.handoff.portal.availability : routeSeed.portal?.availability ?? "locked",
    },
    scene: {
      missionId: config.missionId,
      title: config.title,
      subtitle: config.subtitle,
      summary: config.summary,
      accent: config.accent,
      missionTypeLabel: config.missionTypeLabel,
      environmentLabel: config.environmentLabel,
      objectiveLabel: config.objectiveLabel,
      statusLabel: config.statusLabel,
      returnLabel: config.returnLabel,
      scene: config.scene,
      metadata: config.metadata,
    },
    assets,
    sceneLoading,
    policy,
    bootstrapSource: bootstrap.source,
    bootstrap: {
      requestedMode: bootstrap.requestedMode,
      mode: bootstrap.bootstrap.mode,
      authority: bootstrap.bootstrap.authority,
      roomId: bootstrap.bootstrap.roomId,
      roomLabel: bootstrap.bootstrap.roomLabel,
      seatLabel: bootstrap.bootstrap.seatLabel,
      connectionLabel: bootstrap.bootstrap.connectionLabel,
      objectiveState: bootstrap.bootstrap.objectiveState,
      partySize: bootstrap.bootstrap.partySize,
    },
    session,
    presence: presenceSubscription,
    gameplay,
    completion,
    liveSession: liveSessionSnapshot
      ? projectMetaverseLiveSessionGuidance(liveSessionSnapshot)
      : createDeterministicLocalLiveSessionGuidance(),
    source,
  };
}
