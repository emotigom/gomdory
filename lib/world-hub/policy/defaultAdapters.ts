import {
  createEdgeMissionRoomAccessPolicyPort,
  createEdgeWorldHubAccessPolicyPort,
} from "@/lib/world-hub/policy/edgePolicy";
import {
  localMissionRoomAccessPolicy,
  localWorldHubAccessPolicy,
} from "@/lib/world-hub/policy/localPreview";
import type {
  MissionRoomAccessPolicyPort,
  WorldHubAccessPolicyPort,
} from "@/lib/world-hub/policy/contracts";

function isEdgePolicyEnabled() {
  return process.env.NEXT_PUBLIC_WORLD_HUB_ACCESS_POLICY === "edge";
}

const edgeWorldHubAccessPolicy = createEdgeWorldHubAccessPolicyPort();
const edgeMissionRoomAccessPolicy = createEdgeMissionRoomAccessPolicyPort();

export const defaultWorldHubAccessPolicy: WorldHubAccessPolicyPort = {
  async resolvePolicy(manifest) {
    if (!isEdgePolicyEnabled()) {
      return localWorldHubAccessPolicy.resolvePolicy(manifest);
    }

    return edgeWorldHubAccessPolicy.resolvePolicy(manifest);
  },
};

export const defaultMissionRoomAccessPolicy: MissionRoomAccessPolicyPort = {
  async resolvePolicy(args) {
    if (!isEdgePolicyEnabled()) {
      return localMissionRoomAccessPolicy.resolvePolicy(args);
    }

    return edgeMissionRoomAccessPolicy.resolvePolicy(args);
  },
};
