import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEmptyMetaverseProgressSnapshot,
  createMetaverseProgressSnapshotFromMissionResult,
  metaverseLastCompletedMissionMetadataSchema,
  metaverseRecentMissionCompletionSummarySchema,
  parseMetaverseProgressWriteResult,
  type MetaverseResolvedProgressSnapshot,
  type MetaverseProgressWriteResult,
} from "@/lib/world-hub/progress/contracts";
import type { WorldHubMissionResultReturnPayload } from "@/lib/world-hub/mission/resultHandoff";
import {
  createResolvedMetaverseProgressSnapshotFromRow,
  parseMetaverseProgressRow,
} from "@/lib/world-hub/progress/persistenceRows";

const METAVERSE_PROGRESS_TABLE = "metaverse_progress_snapshots";

type MinimalSupabase = Pick<SupabaseClient, "from">;

type TableSelectResponse = {
  data: unknown;
  error: { message?: string | null } | null;
};

type TableMutationResponse = {
  error: { message?: string | null } | null;
};

function createSupabaseSnapshotSource(args: {
  syncedAtIso: string | null;
  readStatus: "not-requested" | "succeeded" | "fallback" | "failed";
  writeStatus: "not-requested" | "succeeded" | "fallback" | "failed";
  detail: string;
}) {
  return {
    kind: "supabase" as const,
    label: "Supabase metaverse progress",
    detail: args.detail,
    fallbackReason: null,
    diagnostics: {
      mode: "supabase" as const,
      storageKey: null,
      endpoint: "/world-hub/api/progress",
      userScoped: true,
      readStatus: args.readStatus,
      writeStatus: args.writeStatus,
      syncedAtIso: args.syncedAtIso,
    },
  };
}

function createEmptySupabaseSnapshot(detail: string): MetaverseResolvedProgressSnapshot {
  return createEmptyMetaverseProgressSnapshot({
    source: createSupabaseSnapshotSource({
      syncedAtIso: null,
      readStatus: "succeeded",
      writeStatus: "not-requested",
      detail,
    }),
  });
}

function getProgressTable(client: MinimalSupabase) {
  return client.from(METAVERSE_PROGRESS_TABLE as never) as unknown as {
    select(query: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<TableSelectResponse>;
      };
    };
    upsert(payload: Record<string, unknown>, options: { onConflict: string }): Promise<TableMutationResponse>;
  };
}

export async function readMetaverseProgressSnapshotForUser(args: {
  userId: string;
  createAdminClientFn?: () => MinimalSupabase;
}): Promise<MetaverseResolvedProgressSnapshot> {
  const admin = args.createAdminClientFn ? args.createAdminClientFn() : (await import("@/lib/supabase/admin")).createSupabaseAdminClient();
  const table = getProgressTable(admin);
  const { data, error } = await table
    .select("user_id, world_id, recent_completion, last_completed_mission, updated_at")
    .eq("user_id", args.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to read metaverse progress snapshot.");
  }

  if (!data) {
    return createEmptySupabaseSnapshot("No persisted metaverse completion snapshot exists for this user yet.");
  }

  const row = parseMetaverseProgressRow(data);
  return createResolvedMetaverseProgressSnapshotFromRow({
    row,
    source: createSupabaseSnapshotSource({
      syncedAtIso: row.updated_at,
      readStatus: "succeeded",
      writeStatus: "not-requested",
      detail: `Loaded persisted metaverse completion snapshot for ${row.recent_completion.missionTitle}.`,
    }),
  });
}

export async function writeMetaverseProgressSnapshotForUser(args: {
  userId: string;
  payload: WorldHubMissionResultReturnPayload;
  createAdminClientFn?: () => MinimalSupabase;
}): Promise<MetaverseProgressWriteResult> {
  const admin = args.createAdminClientFn ? args.createAdminClientFn() : (await import("@/lib/supabase/admin")).createSupabaseAdminClient();
  const table = getProgressTable(admin);
  const updatedAtIso = new Date().toISOString();

  const row = {
    user_id: args.userId,
    world_id: args.payload.worldId ?? "local-preview-world",
    recent_completion: metaverseRecentMissionCompletionSummarySchema.parse({
      missionId: args.payload.missionId,
      missionTitle: args.payload.missionTitle,
      completedAtIso: args.payload.completedAtIso,
      completionLabel: args.payload.summary.completionLabel,
      objectiveCount: args.payload.summary.objectiveCount,
      completedObjectives: args.payload.summary.completedObjectives,
      percentComplete: args.payload.summary.percentComplete,
      resultLabel: args.payload.summary.resultLabel,
      resultDetail: args.payload.summary.resultDetail,
      rewardSummary: {
        summaryLabel: args.payload.rewards.summaryLabel,
        summaryDetail: args.payload.rewards.summaryDetail,
        highlightedRewardLabel: args.payload.rewards.highlightedRewardLabel,
        placeholderCount: args.payload.rewards.placeholderCount,
        inventoryUpdateCount: args.payload.rewards.inventoryUpdateCount,
      },
      returnHubPath: args.payload.returnHubPath,
    }),
    last_completed_mission: metaverseLastCompletedMissionMetadataSchema.parse({
      worldId: args.payload.worldId,
      sessionId: args.payload.sessionId,
      missionId: args.payload.missionId,
      missionTitle: args.payload.missionTitle,
      completedAtIso: args.payload.completedAtIso,
      issuedAtIso: args.payload.issuedAtIso,
      outcomeLabel: args.payload.outcome.label,
      persistenceStatus: "persisted",
    }),
    updated_at: updatedAtIso,
  };

  const { error } = await table.upsert(row, { onConflict: "user_id" });

  if (error) {
    throw new Error(error.message ?? "Failed to write metaverse progress snapshot.");
  }

  return parseMetaverseProgressWriteResult({
    status: "persisted",
    snapshot: createMetaverseProgressSnapshotFromMissionResult({
      payload: {
        ...args.payload,
        integrations: {
          ...args.payload.integrations,
          persistence: "persisted",
        },
      },
      persistenceStatus: "persisted",
      source: createSupabaseSnapshotSource({
        syncedAtIso: updatedAtIso,
        readStatus: "not-requested",
        writeStatus: "succeeded",
        detail: `Persisted metaverse completion snapshot for ${args.payload.missionTitle}.`,
      }),
    }),
  });
}
