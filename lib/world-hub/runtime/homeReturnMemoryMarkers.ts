import type { WorldHubPoint, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { MetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import type { WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";
import type { WorldHubHomeRepeatVisitCue } from "@/lib/world-hub/runtime/homeRepeatVisitCue";

export type WorldHubHomeReturnMemoryMarkerKind = "return-glow" | "journey-stone" | "reward-ribbon";
export type WorldHubHomeReturnMemoryMarkerTone = "quiet" | "soft" | "warm";

export type WorldHubHomeReturnMemoryMarker = {
  id: string;
  kind: WorldHubHomeReturnMemoryMarkerKind;
  label: string;
  detail: string;
  position: WorldHubPoint;
  accent: string;
  tone: WorldHubHomeReturnMemoryMarkerTone;
  active: boolean;
  chipLabel: string;
};

export type WorldHubHomeReturnMemoryMarkerState = {
  title: string;
  detail: string;
  markers: WorldHubHomeReturnMemoryMarker[];
  activeCount: number;
  source: "resolved-runtime" | "deterministic-fallback";
};

function withSpawnOffset(spawn: WorldHubPoint, offset: WorldHubPoint): WorldHubPoint {
  return {
    x: spawn.x + offset.x,
    y: spawn.y + offset.y,
  };
}

export function resolveWorldHubHomeReturnMemoryMarkerState(args: {
  runtime: WorldHubRuntimeInputs | null;
  identitySummary: MetaverseResolvedIdentitySummary;
  recentJourney: WorldHubRecentJourneyView;
  homeRepeatVisitCue: WorldHubHomeRepeatVisitCue | null;
}): WorldHubHomeReturnMemoryMarkerState {
  if (!args.runtime) {
    return {
      title: "Return memory markers",
      detail: "Home-lane memory markers will settle near your porch after world state resolves.",
      markers: [],
      activeCount: 0,
      source: "deterministic-fallback",
    };
  }

  const spawn = args.runtime.spawn.position;
  const hasMission = args.identitySummary.profile.hasCompletedMission;
  const hasReward =
    args.identitySummary.profile.hasRecentReward || args.identitySummary.collectible.collectibleCount > 0;
  const repeatCue = args.homeRepeatVisitCue;

  const markers: WorldHubHomeReturnMemoryMarker[] = [
    {
      id: "home-return-glow",
      kind: "return-glow",
      label: "Return glow",
      detail: repeatCue
        ? "A small porch glow reflects your recent return rhythm."
        : "Return rhythm marker will appear after repeat visits are established.",
      position: withSpawnOffset(spawn, { x: -2.2, y: 1.8 }),
      accent: repeatCue?.emphasis === "warm" ? "#fbbf24" : repeatCue?.emphasis === "soft" ? "#34d399" : "#94a3b8",
      tone: repeatCue?.emphasis ?? "quiet",
      active: Boolean(repeatCue),
      chipLabel: repeatCue?.chipLabel ?? "Return rhythm pending",
    },
    {
      id: "home-journey-stone",
      kind: "journey-stone",
      label: "Journey stone",
      detail: hasMission
        ? "A carved stone keeps your latest journey continuity grounded near home."
        : "Journey stone remains quiet until your next completed return.",
      position: withSpawnOffset(spawn, { x: 1.9, y: 2.4 }),
      accent: hasMission ? "#60a5fa" : "#64748b",
      tone: hasMission ? "soft" : "quiet",
      active: hasMission,
      chipLabel: hasMission ? args.recentJourney.missionLabel : "No mission memory yet",
    },
    {
      id: "home-reward-ribbon",
      kind: "reward-ribbon",
      label: "Reward ribbon",
      detail: hasReward
        ? "A ribbon pin quietly signals recent keepsake continuity from your latest path."
        : "Ribbon pin waits for your next reward seam.",
      position: withSpawnOffset(spawn, { x: 0.4, y: -2.1 }),
      accent: hasReward ? "#f472b6" : "#64748b",
      tone: hasReward ? "warm" : "quiet",
      active: hasReward,
      chipLabel: hasReward ? args.recentJourney.rewardLabel : "Reward memory pending",
    },
  ];

  const activeCount = markers.filter((marker) => marker.active).length;

  return {
    title: "Return memory markers",
    detail:
      activeCount > 0
        ? `${activeCount} home memory marker${activeCount === 1 ? "" : "s"} currently settled near your porch.`
        : "Markers are placed and waiting for your next return continuity seam.",
    markers,
    activeCount,
    source: "resolved-runtime",
  };
}
