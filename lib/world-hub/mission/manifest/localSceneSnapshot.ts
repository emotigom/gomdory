import type { MissionRoomRouteSeed, MissionRoomSceneConfig } from "@/lib/world-hub/mission/contracts";
import { parseMissionRoomSceneConfig } from "@/lib/world-hub/mission/contracts";
import { getDefaultMissionSceneTemplate } from "@/lib/world-hub/mission/config/defaultMissionScenes";

function createMetadata(routeSeed: MissionRoomRouteSeed) {
  if (routeSeed.mode === "validated-handoff") {
    return [
      { label: "Portal", value: routeSeed.handoff.portal.label },
      { label: "Launch", value: routeSeed.handoff.launchMode },
      { label: "Bootstrap", value: routeSeed.handoff.bootstrapMode },
    ] as const;
  }

  return [
    { label: "Portal", value: routeSeed.portal?.label ?? routeSeed.missionId },
    { label: "Launch", value: "local-fallback" },
    { label: "Bootstrap", value: "local-fallback" },
  ] as const;
}

export function getLocalMissionSceneSnapshot(routeSeed: MissionRoomRouteSeed): MissionRoomSceneConfig {
  const template = getDefaultMissionSceneTemplate(routeSeed.missionId);
  const portalLabel = routeSeed.mode === "validated-handoff" ? routeSeed.handoff.portal.label : routeSeed.portal?.label ?? routeSeed.missionId;
  const summary = routeSeed.mode === "validated-handoff"
    ? routeSeed.handoff.portal.summary
    : routeSeed.portal?.summary ?? "유효한 mission handoff 가 없어 안전한 로컬 fallback runtime 만 제공합니다.";
  const statusLabel = routeSeed.mode === "validated-handoff"
    ? routeSeed.handoff.portal.statusLabel
    : routeSeed.portal?.statusLabel ?? "Fallback only";
  const accent = routeSeed.mode === "validated-handoff" ? routeSeed.handoff.portal.accent : routeSeed.portal?.accent ?? "#94a3b8";

  return parseMissionRoomSceneConfig({
    missionId: routeSeed.missionId,
    title: portalLabel,
    summary,
    accent,
    statusLabel,
    metadata: createMetadata(routeSeed),
    ...template,
  });
}
