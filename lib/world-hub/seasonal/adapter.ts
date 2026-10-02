import {
  parseWorldHubResolvedSeasonalDecorationState,
  parseWorldHubSeasonalDecorationContext,
  type WorldHubResolvedSeasonalDecorationState,
  type WorldHubSeasonalDecorationContext,
  type WorldHubSeasonalDecorationPort,
} from "@/lib/world-hub/seasonal/contracts";
import { getLocalWorldHubSeasonalSnapshot } from "@/lib/world-hub/seasonal/localSnapshot";

function buildFallbackPreviewState(args: {
  context: WorldHubSeasonalDecorationContext;
  now: Date;
  detail: string;
}): WorldHubResolvedSeasonalDecorationState {
  return parseWorldHubResolvedSeasonalDecorationState({
    status: "fallback_preview",
    summary: {
      eyebrow: "Seasonal layer",
      title: "Fallback preview is active",
      detail: args.detail,
      chips: [args.context.classId ? "Class context present" : "Preview context", "Deterministic fallback"],
    },
    layers: [],
    source: {
      kind: "local-preview-snapshot",
      label: "Deterministic local seasonal activation",
      detail: "Seasonal schedule fallback keeps the world-hub decoration seam stable while backend-managed activation is unavailable.",
      fallbackReason: "unavailable-config",
    },
    diagnostics: {
      adapterKind: "local-preview-snapshot",
      resolvedAtIso: args.now.toISOString(),
      matchedScheduleId: null,
      activeLayerCount: 0,
    },
  });
}

export async function readWorldHubSeasonalDecorationState(args?: {
  context?: WorldHubSeasonalDecorationContext | null;
  now?: Date;
}): Promise<WorldHubResolvedSeasonalDecorationState> {
  const now = args?.now ?? new Date();

  if (!args?.context) {
    return buildFallbackPreviewState({
      context: {
        classId: null,
        worldId: "world-hub-preview",
        sessionId: null,
      },
      now,
      detail: "Seasonal context is missing, so the local fallback preview state keeps decoration ordering deterministic.",
    });
  }

  const context = parseWorldHubSeasonalDecorationContext(args.context);
  const snapshot = getLocalWorldHubSeasonalSnapshot({
    context,
    now,
  });

  return parseWorldHubResolvedSeasonalDecorationState({
    status: snapshot.status,
    summary: {
      eyebrow: "Seasonal layer",
      title: snapshot.title,
      detail: snapshot.detail,
      chips: snapshot.chips,
    },
    layers: snapshot.layers,
    source: {
      kind: "local-preview-snapshot",
      label: "Deterministic local seasonal activation",
      detail: "Local schedule snapshots are active today; backend-managed activation can replace this port later.",
      fallbackReason: null,
    },
    diagnostics: {
      adapterKind: "local-preview-snapshot",
      resolvedAtIso: now.toISOString(),
      matchedScheduleId: snapshot.matchedWindowId,
      activeLayerCount: snapshot.layers.filter((entry) => entry.active).length,
    },
  });
}

export function createWorldHubSeasonalDecorationAdapter(args?: {
  now?: () => Date;
}): WorldHubSeasonalDecorationPort {
  const getNow = args?.now ?? (() => new Date());

  return {
    async resolveState({ context }) {
      return readWorldHubSeasonalDecorationState({
        context,
        now: getNow(),
      });
    },
  };
}

export const defaultWorldHubSeasonalDecorationAdapter: WorldHubSeasonalDecorationPort = {
  async resolveState({ context }) {
    return readWorldHubSeasonalDecorationState({ context });
  },
};
