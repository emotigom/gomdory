import type {
  MissionGameplayDiagnostics,
  MissionGameplayLifecycleStatus,
  MissionGameplayObjective,
  MissionGameplayProgress,
  MissionGameplayState,
  MissionGameplayStatePort,
} from "@/lib/world-hub/mission/gameplay/contracts";
import { parseMissionGameplayState } from "@/lib/world-hub/mission/gameplay/contracts";

const DEFAULT_OBJECTIVE_COUNT = 3;

type ObjectiveTemplate = {
  id: string;
  label: string;
  detail: string;
  callToAction: string;
};

function createObjectiveTemplates(args: {
  missionId: string;
  title: string;
  objectiveLabel: string;
  environmentLabel: string;
}) {
  const prefix = args.missionId.replace(/[^a-zA-Z0-9-]/g, "-") || "mission";

  return [
    {
      id: `${prefix}-brief`,
      label: "Review mission briefing",
      detail: `${args.title} objective loaded: ${args.objectiveLabel}`,
      callToAction: "Advance objective",
    },
    {
      id: `${prefix}-align`,
      label: "Perform local systems check",
      detail: `Run the deterministic ${args.environmentLabel.toLowerCase()} checkpoint stub to simulate validated mission progress.`,
      callToAction: "Mark checkpoint complete",
    },
    {
      id: `${prefix}-confirm`,
      label: "Confirm mission completion",
      detail: "Finalize the local preview objective chain so future worker-owned mission state can replace this seam without changing consumers.",
      callToAction: "Complete mission",
    },
  ] satisfies ObjectiveTemplate[];
}

function getObjectiveIndexForBootstrapState(objectiveState: "briefing" | "ready" | "queued") {
  switch (objectiveState) {
    case "ready":
      return 1;
    case "queued":
      return 0;
    case "briefing":
    default:
      return 0;
  }
}

function getLifecycleCopy(args: {
  status: MissionGameplayLifecycleStatus;
  roomLabel: string;
  routeMode: "validated-handoff" | "local-fallback";
}) {
  switch (args.status) {
    case "queued":
      return {
        label: "Queued locally",
        detail: `${args.roomLabel} is holding the deterministic preview mission state until the local objective stub is advanced.`,
      };
    case "briefing":
      return {
        label: "Briefing ready",
        detail:
          args.routeMode === "validated-handoff"
            ? "Mission briefing is ready and can advance locally while worker ownership remains optional."
            : "Mission launched through the fallback path, so briefing remains local and deterministic.",
      };
    case "active":
      return {
        label: "Objective in progress",
        detail: "Mission runtime is exposing resolved objective progress from the local deterministic progression seam.",
      };
    case "completed":
      return {
        label: "Mission complete",
        detail: "All local preview objectives are complete. This remains a placeholder until authoritative validation and rewards are attached.",
      };
    case "failed":
      return {
        label: "Mission failed",
        detail: "Failure handling is currently a placeholder shape only; local preview does not authoritatively fail missions.",
      };
    default:
      return {
        label: "Mission state pending",
        detail: "Mission state could not be resolved.",
      };
  }
}

function createProgress(completedObjectives: number, totalObjectives: number): MissionGameplayProgress {
  const remainingObjectives = Math.max(totalObjectives - completedObjectives, 0);
  const percent = totalObjectives === 0 ? 0 : Math.round((completedObjectives / totalObjectives) * 100);

  return {
    completedObjectives,
    totalObjectives,
    percent,
    remainingObjectives,
    statusLabel:
      remainingObjectives === 0
        ? "All local preview objectives completed"
        : `${completedObjectives}/${totalObjectives} local objectives completed`,
  };
}

function createObjective(args: {
  templates: ObjectiveTemplate[];
  completedObjectives: number;
  lifecycleStatus: MissionGameplayLifecycleStatus;
}): MissionGameplayObjective {
  const totalSteps = args.templates.length || DEFAULT_OBJECTIVE_COUNT;
  const activeIndex = Math.min(args.completedObjectives, totalSteps - 1);
  const template = args.templates[activeIndex] ?? {
    id: "mission-fallback-objective",
    label: "Fallback objective",
    detail: "No local objective templates were available.",
    callToAction: "Advance objective",
  };

  const status =
    args.lifecycleStatus === "completed"
      ? "completed"
      : args.lifecycleStatus === "queued"
        ? "pending"
        : "active";

  return {
    id: template.id,
    label: template.label,
    detail: template.detail,
    stepIndex: Math.min(activeIndex + 1, totalSteps),
    totalSteps,
    status,
    callToAction: args.lifecycleStatus === "completed" ? null : template.callToAction,
  };
}

function createResolution(args: {
  lifecycleStatus: MissionGameplayLifecycleStatus;
  nowIso: string;
}) {
  if (args.lifecycleStatus === "completed") {
    return {
      status: "completed" as const,
      label: "Completion placeholder ready",
      detail: "Local preview marked the mission complete without issuing rewards or authoritative validation.",
      occurredAtIso: args.nowIso,
    };
  }

  if (args.lifecycleStatus === "failed") {
    return {
      status: "failed" as const,
      label: "Failure placeholder ready",
      detail: "Failure is a placeholder contract only; no local mission penalties or sync are applied.",
      occurredAtIso: args.nowIso,
    };
  }

  return {
    status: "pending" as const,
    label: "Awaiting mission resolution",
    detail: "Mission remains in deterministic local preview and has not produced a terminal gameplay outcome.",
    occurredAtIso: null,
  };
}

function createSourceDiagnostics(args: {
  bootstrapObjectiveState: "briefing" | "ready" | "queued";
  policyStatus: "allowed" | "blocked";
  sequence: number;
  transitionCount: number;
  lastEvent: MissionGameplayDiagnostics["lastEvent"];
  lastUpdatedAtIso: string;
  sessionRuntimeAuthority: "local-preview" | "edge-worker";
}): MissionGameplayDiagnostics {
  return {
    adapterKind: "deterministic-local",
    owner: args.sessionRuntimeAuthority === "edge-worker" ? "worker-pending" : "local-preview",
    deterministic: true,
    progressionMode: "local-sequence",
    sequence: args.sequence,
    transitionCount: args.transitionCount,
    bootstrapObjectiveState: args.bootstrapObjectiveState,
    policyStatus: args.policyStatus,
    lastEvent: args.lastEvent,
    lastUpdatedAtIso: args.lastUpdatedAtIso,
  };
}

function resolveLifecycleStatus(args: {
  bootstrapObjectiveState: "briefing" | "ready" | "queued";
  completedObjectives: number;
  totalObjectives: number;
}): MissionGameplayLifecycleStatus {
  if (args.completedObjectives >= args.totalObjectives) {
    return "completed";
  }

  switch (args.bootstrapObjectiveState) {
    case "queued":
      return args.completedObjectives === 0 ? "queued" : "active";
    case "ready":
      return "active";
    case "briefing":
    default:
      return args.completedObjectives === 0 ? "briefing" : "active";
  }
}

function buildGameplayState(args: {
  missionId: string;
  title: string;
  objectiveLabel: string;
  environmentLabel: string;
  roomLabel: string;
  routeMode: "validated-handoff" | "local-fallback";
  bootstrapObjectiveState: "briefing" | "ready" | "queued";
  completedObjectives: number;
  sequence: number;
  transitionCount: number;
  lastEvent: MissionGameplayDiagnostics["lastEvent"];
  policyStatus: "allowed" | "blocked";
  sessionRuntimeAuthority: "local-preview" | "edge-worker";
  nowIso: string;
}): MissionGameplayState {
  const templates = createObjectiveTemplates({
    missionId: args.missionId,
    title: args.title,
    objectiveLabel: args.objectiveLabel,
    environmentLabel: args.environmentLabel,
  });
  const totalObjectives = Math.max(templates.length, DEFAULT_OBJECTIVE_COUNT);
  const boundedCompletedObjectives = Math.min(Math.max(args.completedObjectives, 0), totalObjectives);
  const lifecycleStatus = resolveLifecycleStatus({
    bootstrapObjectiveState: args.bootstrapObjectiveState,
    completedObjectives: boundedCompletedObjectives,
    totalObjectives,
  });
  const lifecycleCopy = getLifecycleCopy({
    status: lifecycleStatus,
    roomLabel: args.roomLabel,
    routeMode: args.routeMode,
  });

  return parseMissionGameplayState({
    missionId: args.missionId,
    lifecycle: {
      status: lifecycleStatus,
      label: lifecycleCopy.label,
      detail: lifecycleCopy.detail,
    },
    objective: createObjective({
      templates,
      completedObjectives: boundedCompletedObjectives,
      lifecycleStatus,
    }),
    progress: createProgress(boundedCompletedObjectives, totalObjectives),
    resolution: createResolution({
      lifecycleStatus,
      nowIso: args.nowIso,
    }),
    source: {
      kind: "deterministic-local",
      label: "Deterministic local gameplay state",
      detail:
        args.sessionRuntimeAuthority === "edge-worker"
          ? "Mission gameplay state remains local and deterministic until worker-owned state snapshots are connected."
          : "Mission gameplay state is resolved entirely from deterministic local objective progression.",
      diagnostics: createSourceDiagnostics({
        bootstrapObjectiveState: args.bootstrapObjectiveState,
        policyStatus: args.policyStatus,
        sequence: args.sequence,
        transitionCount: args.transitionCount,
        lastEvent: args.lastEvent,
        lastUpdatedAtIso: args.nowIso,
        sessionRuntimeAuthority: args.sessionRuntimeAuthority,
      }),
    },
  });
}

export function resolveDeterministicLocalMissionGameplayState(args: {
  missionId: string;
  title: string;
  objectiveLabel: string;
  environmentLabel: string;
  roomLabel: string;
  routeMode: "validated-handoff" | "local-fallback";
  bootstrapObjectiveState: "briefing" | "ready" | "queued";
  policyStatus: "allowed" | "blocked";
  sessionRuntimeAuthority: "local-preview" | "edge-worker";
  completedObjectives?: number;
  sequence?: number;
  transitionCount?: number;
  lastEvent?: MissionGameplayDiagnostics["lastEvent"];
  now?: Date;
}) {
  const sequence = args.sequence ?? 0;
  const transitionCount = args.transitionCount ?? 0;
  const completedObjectives =
    args.completedObjectives ?? getObjectiveIndexForBootstrapState(args.bootstrapObjectiveState);

  return buildGameplayState({
    missionId: args.missionId,
    title: args.title,
    objectiveLabel: args.objectiveLabel,
    environmentLabel: args.environmentLabel,
    roomLabel: args.roomLabel,
    routeMode: args.routeMode,
    bootstrapObjectiveState: args.bootstrapObjectiveState,
    completedObjectives,
    sequence,
    transitionCount,
    lastEvent: args.lastEvent ?? "initialized",
    policyStatus: args.policyStatus,
    sessionRuntimeAuthority: args.sessionRuntimeAuthority,
    nowIso: (args.now ?? new Date()).toISOString(),
  });
}

export function advanceDeterministicLocalMissionGameplayState(args: {
  current: MissionGameplayState;
  loadedSceneConfig: {
    config: {
      missionId: string;
      title: string;
      objectiveLabel: string;
      environmentLabel: string;
    };
  };
  bootstrap: {
    bootstrap: {
      roomLabel: string;
      objectiveState: "briefing" | "ready" | "queued";
      authority: "local-preview" | "edge-worker";
    };
  };
  routeSeed: {
    mode: "validated-handoff" | "local-fallback";
  };
  policy: {
    entry: {
      status: "allowed" | "blocked";
    };
  };
  now?: Date;
}) {
  const totalObjectives = args.current.progress.totalObjectives;
  const nextCompletedObjectives = Math.min(args.current.progress.completedObjectives + 1, totalObjectives);
  const nextLifecycleStatus = resolveLifecycleStatus({
    bootstrapObjectiveState: args.bootstrap.bootstrap.objectiveState,
    completedObjectives: nextCompletedObjectives,
    totalObjectives,
  });

  return buildGameplayState({
    missionId: args.loadedSceneConfig.config.missionId,
    title: args.loadedSceneConfig.config.title,
    objectiveLabel: args.loadedSceneConfig.config.objectiveLabel,
    environmentLabel: args.loadedSceneConfig.config.environmentLabel,
    roomLabel: args.bootstrap.bootstrap.roomLabel,
    routeMode: args.routeSeed.mode,
    bootstrapObjectiveState: args.bootstrap.bootstrap.objectiveState,
    completedObjectives: nextCompletedObjectives,
    sequence: args.current.source.diagnostics.sequence + 1,
    transitionCount: args.current.source.diagnostics.transitionCount + 1,
    lastEvent: nextLifecycleStatus === "completed" ? "completed" : "advanced",
    policyStatus: args.policy.entry.status,
    sessionRuntimeAuthority: args.bootstrap.bootstrap.authority,
    nowIso: (args.now ?? new Date()).toISOString(),
  });
}

export function createDeterministicLocalMissionGameplayPort(): MissionGameplayStatePort {
  return {
    async resolveInitialState(args) {
      return resolveDeterministicLocalMissionGameplayState({
        missionId: args.loadedSceneConfig.config.missionId,
        title: args.loadedSceneConfig.config.title,
        objectiveLabel: args.loadedSceneConfig.config.objectiveLabel,
        environmentLabel: args.loadedSceneConfig.config.environmentLabel,
        roomLabel: args.bootstrap.bootstrap.roomLabel,
        routeMode: args.routeSeed.mode,
        bootstrapObjectiveState: args.bootstrap.bootstrap.objectiveState,
        policyStatus: args.policy.entry.status,
        sessionRuntimeAuthority: args.session.runtimeAuthority,
      });
    },
    async advance(args) {
      return advanceDeterministicLocalMissionGameplayState({
        current: args.current,
        loadedSceneConfig: args.loadedSceneConfig,
        bootstrap: args.bootstrap,
        routeSeed: args.routeSeed,
        policy: args.policy,
      });
    },
  };
}
