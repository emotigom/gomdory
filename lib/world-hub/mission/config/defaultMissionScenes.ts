import type {
  MissionRoomEdgeSceneTemplate,
  MissionRoomSceneConfig,
} from "@/lib/world-hub/mission/contracts";

const DEFAULT_MISSION_SCENE_TEMPLATES: Record<string, Omit<MissionRoomSceneConfig, "missionId" | "title" | "summary" | "accent" | "statusLabel" | "metadata">> = {
  "mission-orbit-lab": {
    subtitle: "Local briefing deck",
    missionTypeLabel: "Co-op systems check",
    environmentLabel: "Orbital relay deck",
    objectiveLabel: "Align the console array to restore the classroom beacon.",
    returnLabel: "Return to world hub",
    bootstrap: {
      mode: "local-single-user",
      roomId: "orbit-lab-local-room",
      roomLabel: "Orbit Lab Local Room",
      objectiveState: "briefing",
    },
    scene: {
      containerLabel: "Mission Scene Container",
      containerSummary: "A narrow typed runtime wrapper for mission initialization.",
      placeholderTitle: "Objective placeholder",
      placeholderBody: "This room only proves route bootstrap, typed scene config, and safe navigation back to the hub.",
    },
  },
  "mission-creative-arcade": {
    subtitle: "Prototype mission bay",
    missionTypeLabel: "Creative challenge stub",
    environmentLabel: "Arcade test chamber",
    objectiveLabel: "Review mission-specific rules, then wait for richer edge-backed room behavior.",
    returnLabel: "Return to world hub",
    bootstrap: {
      mode: "local-single-user",
      roomId: "creative-arcade-local-room",
      roomLabel: "Creative Arcade Local Room",
      objectiveState: "queued",
    },
    scene: {
      containerLabel: "Mission Scene Container",
      containerSummary: "A local-only preview surface for future queue/bootstrap contracts.",
      placeholderTitle: "Status placeholder",
      placeholderBody: "Future worker-issued room joins can replace this deterministic local room bootstrap without changing the route contract.",
    },
  },
};

const FALLBACK_TEMPLATE: Omit<MissionRoomSceneConfig, "missionId" | "title" | "summary" | "accent" | "statusLabel" | "metadata"> = {
  subtitle: "Fallback mission shell",
  missionTypeLabel: "Unknown mission",
  environmentLabel: "Safe fallback container",
  objectiveLabel: "Return to the hub and relaunch from a known portal.",
  returnLabel: "Return to world hub",
  bootstrap: {
    mode: "local-single-user",
    roomId: "unknown-mission-local-room",
    roomLabel: "Unknown Mission Local Room",
    objectiveState: "briefing",
  },
  scene: {
    containerLabel: "Mission Scene Container",
    containerSummary: "Fallback preview for invalid or missing handoff state.",
    placeholderTitle: "Fallback status",
    placeholderBody: "The mission launched without a valid handoff payload, so only a safe local shell is shown.",
  },
};

export function getDefaultMissionSceneTemplate(missionId: string) {
  return DEFAULT_MISSION_SCENE_TEMPLATES[missionId] ?? FALLBACK_TEMPLATE;
}

export function hasDefaultMissionSceneTemplate(missionId: string) {
  return missionId in DEFAULT_MISSION_SCENE_TEMPLATES;
}

export function getDefaultMissionEdgeSceneTemplate(missionId: string): MissionRoomEdgeSceneTemplate | null {
  const template = DEFAULT_MISSION_SCENE_TEMPLATES[missionId];
  if (!template) {
    return null;
  }

  return {
    missionId,
    subtitle: template.subtitle,
    missionTypeLabel: template.missionTypeLabel,
    environmentLabel: template.environmentLabel,
    objectiveLabel: template.objectiveLabel,
    returnLabel: template.returnLabel,
    bootstrap: template.bootstrap,
    scene: template.scene,
    metadata: [
      { label: "Config", value: "edge-template" },
      { label: "Bootstrap seam", value: template.bootstrap.mode },
    ],
  };
}
