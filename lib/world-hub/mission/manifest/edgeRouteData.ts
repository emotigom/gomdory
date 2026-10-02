import type { MissionRoomEdgeSceneTemplate } from "@/lib/world-hub/mission/contracts";
import {
  getDefaultMissionEdgeSceneTemplate,
  hasDefaultMissionSceneTemplate,
} from "@/lib/world-hub/mission/config/defaultMissionScenes";

export function getEdgeMissionSceneTemplate(missionId: string): MissionRoomEdgeSceneTemplate | null {
  if (!hasDefaultMissionSceneTemplate(missionId)) {
    return null;
  }

  return getDefaultMissionEdgeSceneTemplate(missionId);
}
