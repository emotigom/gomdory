import type { MissionGameplayState } from "@/lib/world-hub/mission/gameplay/contracts";

import {
  parseMissionCompletionResolvedState,
  type MissionCompletionDiagnostics,
  type MissionCompletionPort,
  type MissionCompletionResolvedState,
  type MissionCompletionRewardPlaceholder,
} from "@/lib/world-hub/mission/completion/contracts";
import type { MetaverseMissionRewardHookResolved, MetaverseMissionRewardHookPort } from "@/lib/world-hub/rewards/contracts";
import {
  createDeterministicLocalMissionRewardHookPort,
  resolveDeterministicMissionRewardSummary,
} from "@/lib/world-hub/rewards/localRewardHook";

function createOutcome(gameplay: MissionGameplayState) {
  switch (gameplay.lifecycle.status) {
    case "completed":
      return {
        status: "completed" as const,
        label: "Mission completion ready",
        detail: "Deterministic local completion resolved a stable mission result placeholder from the gameplay snapshot.",
      };
    case "failed":
      return {
        status: "failed" as const,
        label: "Mission failure placeholder ready",
        detail: "Failure remains a placeholder-only result until authoritative validation is connected.",
      };
    default:
      return {
        status: "pending" as const,
        label: "Completion pending",
        detail: "Mission completion remains unresolved until the deterministic objective chain reaches a terminal gameplay state.",
      };
  }
}

function createResult(gameplay: MissionGameplayState) {
  switch (gameplay.lifecycle.status) {
    case "completed":
      return {
        kind: "preview" as const,
        label: "Local completion result",
        detail: "A preview-safe mission result is available for runtime consumers without requiring persistence, rewards, or realtime sync.",
        teacherReportStatus: "not-generated" as const,
        inventoryStatus: "placeholder-ready" as const,
        nextActionLabel: "Return to world hub",
      };
    case "failed":
      return {
        kind: "failed-placeholder" as const,
        label: "Failure placeholder result",
        detail: "Failure reporting is reserved for a future seam; the runtime only exposes a stable placeholder contract right now.",
        teacherReportStatus: "not-generated" as const,
        inventoryStatus: "unavailable" as const,
        nextActionLabel: "Retry local mission bootstrap",
      };
    default:
      return {
        kind: "validated-placeholder" as const,
        label: "Result not ready",
        detail: "Mission runtime consumers receive a resolved placeholder shape even before completion is reached.",
        teacherReportStatus: "not-generated" as const,
        inventoryStatus: "not-issued" as const,
        nextActionLabel: null,
      };
  }
}

function createRewardPlaceholders(args: {
  missionId: string;
  title: string;
  status: "pending" | "completed" | "failed";
  returnLabel: string;
}): MissionCompletionRewardPlaceholder[] {
  const pendingStatus = args.status === "failed" ? "unavailable" : args.status === "completed" ? "placeholder" : "pending";

  return [
    {
      id: `${args.missionId}-reward-badge`,
      kind: "badge",
      label: `${args.title} completion badge`,
      detail: "Placeholder reward contract for a future achievement/badge seam.",
      quantity: 1,
      status: pendingStatus,
    },
    {
      id: `${args.missionId}-reward-report`,
      kind: "report",
      label: "Teacher/class report stub",
      detail: "Placeholder result sink for future class reporting and progress rollups.",
      quantity: null,
      status: pendingStatus,
    },
    {
      id: `${args.missionId}-return-hub`,
      kind: "hub-return",
      label: args.returnLabel,
      detail: "Placeholder post-mission navigation seam for returning the player to the hub after completion.",
      quantity: null,
      status: args.status === "failed" ? "unavailable" : args.status === "completed" ? "placeholder" : "pending",
    },
  ];
}

function createDiagnostics(args: {
  gameplay: MissionGameplayState;
  emittedAtIso: string;
}): MissionCompletionDiagnostics {
  return {
    adapterKind: "deterministic-local",
    deterministic: true,
    derivedFrom: "gameplay-state",
    lastEvent:
      args.gameplay.lifecycle.status === "completed"
        ? "completion-ready"
        : args.gameplay.lifecycle.status === "failed"
          ? "failure-ready"
          : args.gameplay.source.diagnostics.sequence === 0
            ? "initialized"
            : "progress-updated",
    sequence: args.gameplay.source.diagnostics.sequence,
    transitionCount: args.gameplay.source.diagnostics.transitionCount,
    resultVersion: "mission-completion-v1",
    rewardIntegration: "placeholder-only",
    persistence: "none",
    reporting: "none",
    validatedBy: args.gameplay.source.diagnostics.owner === "worker-pending" ? "worker-pending" : "local-preview",
    emittedAtIso: args.emittedAtIso,
  };
}

function buildMissionCompletionResolvedState(args: {
  routeMode: "validated-handoff" | "local-fallback";
  missionId: string;
  title: string;
  returnHubPath: string;
  returnLabel: string;
  runtimeAuthority: "local-preview" | "edge-worker";
  gameplay: MissionGameplayState;
  rewardSummary: MetaverseMissionRewardHookResolved;
  now?: Date;
}): MissionCompletionResolvedState {
  const emittedAtIso = (args.now ?? new Date()).toISOString();
  const outcome = createOutcome(args.gameplay);
  const result = createResult(args.gameplay);
  const rewardPlaceholders = createRewardPlaceholders({
    missionId: args.missionId,
    title: args.title,
    status: outcome.status,
    returnLabel: args.returnLabel,
  });

  return parseMissionCompletionResolvedState({
    missionId: args.missionId,
    outcome,
    metadata: {
      completedAtIso: args.gameplay.resolution.occurredAtIso,
      objectiveCount: args.gameplay.progress.totalObjectives,
      completedObjectives: args.gameplay.progress.completedObjectives,
      percentComplete: args.gameplay.progress.percent,
      routeMode: args.routeMode,
      runtimeAuthority: args.runtimeAuthority,
      validationState:
        outcome.status === "completed"
          ? args.runtimeAuthority === "edge-worker"
            ? "worker-pending"
            : "not-requested"
          : "not-requested",
      returnFlow: {
        available: true,
        hubPath: args.returnHubPath,
        label: args.returnLabel,
      },
    },
    result,
    rewards: {
      status: outcome.status === "failed" ? "unavailable" : outcome.status === "completed" ? "placeholder" : "pending",
      placeholders: rewardPlaceholders,
      summary: args.rewardSummary,
    },
    source: {
      kind: "deterministic-local",
      label: "Deterministic local completion seam",
      detail:
        outcome.status === "completed"
          ? "Stable completion/result data was resolved locally from mission gameplay state without backend validation."
          : "Completion/result data is derived from local mission gameplay state and remains replaceable by a worker-backed validator.",
      diagnostics: createDiagnostics({
        gameplay: args.gameplay,
        emittedAtIso,
      }),
    },
  });
}

export function resolveDeterministicLocalMissionCompletionResult(args: {
  routeMode: "validated-handoff" | "local-fallback";
  missionId: string;
  title: string;
  returnHubPath: string;
  returnLabel: string;
  runtimeAuthority: "local-preview" | "edge-worker";
  gameplay: MissionGameplayState;
  now?: Date;
}): MissionCompletionResolvedState {
  const rewardSummary = resolveDeterministicMissionRewardSummary({
    missionId: args.missionId,
    missionTitle: args.title,
    returnLabel: args.returnLabel,
    routeMode: args.routeMode,
    runtimeAuthority: args.runtimeAuthority,
    completion: {
      status: args.gameplay.lifecycle.status === "completed" ? "completed" : args.gameplay.lifecycle.status === "failed" ? "failed" : "pending",
      resultKind:
        args.gameplay.lifecycle.status === "completed"
          ? "preview"
          : args.gameplay.lifecycle.status === "failed"
            ? "failed-placeholder"
            : "validated-placeholder",
      completedAtIso: args.gameplay.resolution.occurredAtIso,
      objectiveCount: args.gameplay.progress.totalObjectives,
      completedObjectives: args.gameplay.progress.completedObjectives,
      percentComplete: args.gameplay.progress.percent,
    },
    now: args.now,
  });

  return buildMissionCompletionResolvedState({
    ...args,
    rewardSummary,
  });
}

export function createDeterministicLocalMissionCompletionPort(args?: {
  rewardHook?: MetaverseMissionRewardHookPort;
}): MissionCompletionPort {
  const rewardHook = args?.rewardHook ?? createDeterministicLocalMissionRewardHookPort();

  async function resolve(args: {
    routeMode: "validated-handoff" | "local-fallback";
    missionId: string;
    title: string;
    returnHubPath: string;
    returnLabel: string;
    runtimeAuthority: "local-preview" | "edge-worker";
    gameplay: MissionGameplayState;
  }) {
    const rewardSummary = await rewardHook.resolveRewardSummary({
      missionId: args.missionId,
      missionTitle: args.title,
      returnLabel: args.returnLabel,
      routeMode: args.routeMode,
      runtimeAuthority: args.runtimeAuthority,
      completion: {
        status: args.gameplay.lifecycle.status === "completed" ? "completed" : args.gameplay.lifecycle.status === "failed" ? "failed" : "pending",
        resultKind:
          args.gameplay.lifecycle.status === "completed"
            ? "preview"
            : args.gameplay.lifecycle.status === "failed"
              ? "failed-placeholder"
              : "validated-placeholder",
        completedAtIso: args.gameplay.resolution.occurredAtIso,
        objectiveCount: args.gameplay.progress.totalObjectives,
        completedObjectives: args.gameplay.progress.completedObjectives,
        percentComplete: args.gameplay.progress.percent,
      },
    });

    return buildMissionCompletionResolvedState({
      ...args,
      rewardSummary,
    });
  }

  return {
    async resolveInitialResult(args) {
      return resolve({
        routeMode: args.routeSeed.mode,
        missionId: args.loadedSceneConfig.config.missionId,
        title: args.loadedSceneConfig.config.title,
        returnHubPath: args.routeSeed.returnHubPath,
        returnLabel: args.loadedSceneConfig.config.returnLabel,
        runtimeAuthority: args.session.runtimeAuthority,
        gameplay: args.gameplay,
      });
    },
    async syncResolvedResult(args) {
      return resolve({
        routeMode: args.routeSeed.mode,
        missionId: args.loadedSceneConfig.config.missionId,
        title: args.loadedSceneConfig.config.title,
        returnHubPath: args.routeSeed.returnHubPath,
        returnLabel: args.loadedSceneConfig.config.returnLabel,
        runtimeAuthority: args.session.runtimeAuthority,
        gameplay: args.gameplay,
      });
    },
  };
}
