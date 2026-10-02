import type { WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomRouteSeed,
} from "@/lib/world-hub/mission/contracts";
import {
  parseMissionRoomResolvedAccessPolicy,
  parseWorldHubResolvedAccessPolicy,
  type AccessPolicyDecision,
  type AccessPolicyFallbackReason,
  type AccessPolicyResolution,
  type MissionRoomAccessPolicyPort,
  type MissionRoomResolvedAccessPolicy,
  type WorldHubAccessPolicyPort,
  type WorldHubResolvedAccessPolicy,
} from "@/lib/world-hub/policy/contracts";

function createAllowedDecision(args: {
  code?: AccessPolicyDecision["code"];
  label: string;
  detail?: string | null;
}): AccessPolicyDecision {
  return {
    status: "allowed",
    code: args.code ?? "allowed",
    label: args.label,
    detail: args.detail ?? null,
  };
}

function createBlockedDecision(args: {
  code: AccessPolicyDecision["code"];
  label: string;
  detail?: string | null;
}): AccessPolicyDecision {
  return {
    status: "blocked",
    code: args.code,
    label: args.label,
    detail: args.detail ?? null,
  };
}

export function buildDeterministicLocalWorldHubAccessPolicy(args: {
  manifest: WorldHubSceneManifest;
  label?: string;
  detail?: string | null;
  fallbackReason?: AccessPolicyFallbackReason | null;
  resolution?: AccessPolicyResolution;
  adapterKind?: WorldHubResolvedAccessPolicy["diagnostics"]["adapterKind"];
}): WorldHubResolvedAccessPolicy {
  const evaluatedAtIso = new Date().toISOString();

  return parseWorldHubResolvedAccessPolicy({
    runtime: "world-hub",
    scope: {
      classId: null,
      sessionId: null,
      worldId: args.manifest.worldId,
      missionId: null,
    },
    source: {
      kind: "local-preview",
      label: args.label ?? "Deterministic local access snapshot",
      detail:
        args.detail ??
        "Local preview policy keeps classroom gating deterministic while backend class-control adapters are still replaceable.",
      fallbackReason: args.fallbackReason ?? null,
    },
    resolution: args.resolution ?? "resolved",
    preview: {
      mode: "allow-local-preview",
      fallback: "allow",
      label: "Local preview allowed",
      detail: "Preview policy allows local classroom-free world entry until live class controls are connected.",
    },
    entry: createAllowedDecision({
      code: "preview-allowed",
      label: "World hub preview allowed",
      detail: "No teacher/session gate is attached in deterministic local preview mode.",
    }),
    missions: args.manifest.portals.map((portal) => ({
      missionId: portal.id,
      decision:
        portal.availability === "locked"
          ? createBlockedDecision({
              code: "teacher-blocked",
              label: "Mission join blocked",
              detail: `${portal.label} is marked locked in the local preview snapshot.`,
            })
          : createAllowedDecision({
              code: portal.availability === "queued" ? "preview-allowed" : "allowed",
              label: portal.availability === "queued" ? "Mission queue preview available" : "Mission join allowed",
              detail:
                portal.availability === "queued"
                  ? `${portal.label} remains joinable in preview mode while preserving queued status metadata.`
                  : `${portal.label} inherits open preview access from the local world snapshot.`,
            }),
    })),
    diagnostics: {
      adapterKind: args.adapterKind ?? "local-preview-snapshot",
      resolution: args.resolution ?? "resolved",
      scopeAlignment: "unscoped",
      evaluatedAtIso,
      summary: "Deterministic local world-hub access policy resolved without teacher/class scope.",
    },
  });
}

export function buildDeterministicLocalMissionRoomAccessPolicy(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
  label?: string;
  detail?: string | null;
  fallbackReason?: AccessPolicyFallbackReason | null;
  resolution?: AccessPolicyResolution;
  adapterKind?: MissionRoomResolvedAccessPolicy["diagnostics"]["adapterKind"];
}): MissionRoomResolvedAccessPolicy {
  const evaluatedAtIso = new Date().toISOString();
  const scopeAlignment =
    args.loadedSceneConfig.config.missionId === args.routeSeed.missionId ? "unscoped" : "mission-mismatch";

  const worldId = args.routeSeed.mode === "validated-handoff" ? args.routeSeed.handoff.worldId : "local-preview-world";
  const previewDecision =
    scopeAlignment === "mission-mismatch"
      ? createBlockedDecision({
          code: "mission-mismatch",
          label: "Mission access blocked",
          detail: `Resolved scene config ${args.loadedSceneConfig.config.missionId} does not match route mission ${args.routeSeed.missionId}.`,
        })
      : createAllowedDecision({
          code: args.routeSeed.mode === "validated-handoff" ? "allowed" : "preview-allowed",
          label: args.routeSeed.mode === "validated-handoff" ? "Mission access allowed" : "Fallback mission preview allowed",
          detail:
            args.routeSeed.mode === "validated-handoff"
              ? "Validated handoff scope is accepted by the local preview policy seam."
              : "Mission room remains reachable through deterministic local fallback while backend policy is unavailable.",
        });

  return parseMissionRoomResolvedAccessPolicy({
    runtime: "mission-room",
    scope: {
      classId: null,
      sessionId: args.routeSeed.mode === "validated-handoff" ? args.routeSeed.handoff.sessionId : null,
      worldId,
      missionId: args.routeSeed.missionId,
    },
    source: {
      kind: "local-preview",
      label: args.label ?? "Deterministic local mission policy",
      detail:
        args.detail ??
        "Mission-room policy is derived from the stable route seed and local scene snapshot instead of raw backend payloads.",
      fallbackReason: args.fallbackReason ?? null,
    },
    resolution: args.resolution ?? "resolved",
    preview: {
      mode: "allow-local-preview",
      fallback: "allow",
      label: "Mission preview allowed",
      detail: "Local mission previews remain deterministic even when classroom controls are not yet connected.",
    },
    entry: previewDecision,
    diagnostics: {
      adapterKind: args.adapterKind ?? "local-preview-snapshot",
      resolution: args.resolution ?? "resolved",
      scopeAlignment,
      evaluatedAtIso,
      summary:
        scopeAlignment === "mission-mismatch"
          ? "Mission-room policy blocked due to a route/config mismatch."
          : "Deterministic local mission-room policy resolved without teacher/class scope.",
    },
  });
}

export const localWorldHubAccessPolicy: WorldHubAccessPolicyPort = {
  async resolvePolicy(manifest) {
    return buildDeterministicLocalWorldHubAccessPolicy({ manifest });
  },
};

export const localMissionRoomAccessPolicy: MissionRoomAccessPolicyPort = {
  async resolvePolicy(args) {
    return buildDeterministicLocalMissionRoomAccessPolicy(args);
  },
};
