import {
  parseMetaverseLaunchControlContext,
  parseMetaverseResolvedLaunchControlState,
  type MetaverseLaunchControlContext,
  type MetaverseLaunchControlFallbackReason,
  type MetaverseLaunchControlPort,
  type MetaverseResolvedLaunchControlState,
} from "@/lib/world-hub/launch/contracts";
import { getLocalMetaverseLaunchControlSnapshot } from "@/lib/world-hub/launch/localSnapshot";

const DEFAULT_PREVIEW_WORLD_ID = "local-preview-world";

function createLocalLaunchControlState(args?: {
  context?: MetaverseLaunchControlContext | null;
  fallbackReason?: MetaverseLaunchControlFallbackReason | null;
  resolution?: MetaverseResolvedLaunchControlState["resolution"];
}): MetaverseResolvedLaunchControlState {
  const context = args?.context
    ? parseMetaverseLaunchControlContext(args.context)
    : {
        classId: null,
        worldId: DEFAULT_PREVIEW_WORLD_ID,
        sessionId: null,
      };

  const snapshot = getLocalMetaverseLaunchControlSnapshot(context.classId);
  const evaluatedAtIso = new Date().toISOString();
  const scopeContext = context.classId ? "classroom" : "preview";
  const resolution = args?.resolution ?? (context.classId ? "resolved" : "fallback");
  const fallbackReason =
    args?.fallbackReason ?? (context.classId ? "preview-mode" : "classroom-context-unavailable");

  return parseMetaverseResolvedLaunchControlState({
    version: 1,
    scope: {
      classId: context.classId,
      worldId: context.worldId,
      sessionId: context.sessionId,
      context: scopeContext,
    },
    source: {
      kind: "local-preview-snapshot",
      label: snapshot.sourceLabel,
      detail: snapshot.sourceDetail,
      fallbackReason,
    },
    resolution,
    preview: {
      mode: context.classId ? "local-snapshot" : "fallback-open-preview",
      fallback: "inherit-mission-availability",
      label: context.classId ? "Class snapshot preview" : "Preview fallback open",
      detail: context.classId
        ? "Class-scoped preview data was resolved from a deterministic local snapshot."
        : "No class-scoped launch configuration is attached here, so preview mode keeps world entry open and mission state deterministic.",
    },
    metadata: snapshot.metadata,
    hubEntry: snapshot.hubEntry,
    missionOverrides: snapshot.missionOverrides,
    diagnostics: {
      adapterKind: context.classId ? "local-preview-snapshot" : "local-preview-fallback",
      resolution,
      scopeContext,
      snapshotKey: snapshot.key,
      missionOverrideCount: snapshot.missionOverrides.length,
      evaluatedAtIso,
      summary: context.classId
        ? `Resolved class-scoped launch controls from local preview snapshot ${snapshot.key}.`
        : `Fell back to preview launch controls from local snapshot ${snapshot.key} because no class scope was provided.`,
    },
  });
}

export async function readMetaverseLaunchControlState(args?: {
  context?: MetaverseLaunchControlContext | null;
}): Promise<MetaverseResolvedLaunchControlState> {
  return createLocalLaunchControlState(args);
}

export function createMetaverseLaunchControlAdapter(args?: {
  context?: MetaverseLaunchControlContext | null;
}): MetaverseLaunchControlPort {
  return {
    async resolveLaunchControls(input) {
      return readMetaverseLaunchControlState({
        context: input?.context ?? args?.context ?? null,
      });
    },
  };
}

export const defaultMetaverseLaunchControlAdapter: MetaverseLaunchControlPort = {
  async resolveLaunchControls(args) {
    return createLocalLaunchControlState({
      context: args?.context ?? null,
    });
  },
};
