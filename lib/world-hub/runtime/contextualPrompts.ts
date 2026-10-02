import type { WorldHubPortalManifest, WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";

const PORTAL_INTERACTION_RADIUS = 10;
const HOME_INTERACTION_RADIUS = 11;
const ACADEMY_INTERACTION_RADIUS = 11;

type ContextualCueKind = "portal" | "home" | "academy";

type ContextualCueCandidate = {
  kind: ContextualCueKind;
  distance: number;
  priority: number;
  portal?: WorldHubPortalManifest;
};

export type WorldHubNearbyContextualCue =
  | {
      kind: "portal";
      distance: number;
      portal: WorldHubPortalManifest;
    }
  | {
      kind: "home" | "academy";
      distance: number;
    }
  | null;

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function compareCandidates(left: ContextualCueCandidate, right: ContextualCueCandidate) {
  const leftScore = left.distance + left.priority * 0.5;
  const rightScore = right.distance + right.priority * 0.5;
  if (leftScore !== rightScore) return leftScore - rightScore;
  if (left.distance !== right.distance) return left.distance - right.distance;
  return left.kind.localeCompare(right.kind);
}

export function resolveWorldHubNearbyContextualCue(args: {
  runtime: Pick<WorldHubRuntimeInputs, "spawn" | "kiosk" | "portals">;
  playerPosition: { x: number; y: number };
  selectedPortalId?: string | null;
}): WorldHubNearbyContextualCue {
  const { playerPosition, runtime, selectedPortalId = null } = args;

  const portalCandidates = runtime.portals
    .map((portal) => ({ portal, distance: distanceBetween(playerPosition, portal.position) }))
    .filter(({ distance }) => distance <= PORTAL_INTERACTION_RADIUS)
    .sort((left, right) => {
      if (selectedPortalId) {
        const leftSelected = left.portal.id === selectedPortalId;
        const rightSelected = right.portal.id === selectedPortalId;
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      }
      return left.distance - right.distance;
    });

  const candidates: ContextualCueCandidate[] = [];
  const nearestPortal = portalCandidates[0];
  if (nearestPortal) {
    candidates.push({
      kind: "portal",
      distance: nearestPortal.distance,
      priority: selectedPortalId === nearestPortal.portal.id ? -1 : 0,
      portal: nearestPortal.portal,
    });
  }

  const homeDistance = distanceBetween(playerPosition, runtime.spawn.position);
  if (homeDistance <= HOME_INTERACTION_RADIUS) {
    candidates.push({ kind: "home", distance: homeDistance, priority: 1 });
  }

  const academyDistance = distanceBetween(playerPosition, runtime.kiosk.position);
  if (academyDistance <= ACADEMY_INTERACTION_RADIUS) {
    candidates.push({ kind: "academy", distance: academyDistance, priority: 1.5 });
  }

  const winner = candidates.sort(compareCandidates)[0];
  if (!winner) return null;
  if (winner.kind === "portal" && winner.portal) {
    return {
      kind: "portal",
      distance: winner.distance,
      portal: winner.portal,
    };
  }
  return {
    kind: winner.kind === "home" ? "home" : "academy",
    distance: winner.distance,
  };
}
