import { z } from "zod";

import {
  createMetaverseProgressSnapshotFromMissionResult,
  metaverseLastCompletedMissionMetadataSchema,
  metaverseRecentMissionCompletionSummarySchema,
  type MetaverseProgressSource,
  type MetaverseResolvedProgressSnapshot,
} from "@/lib/world-hub/progress/contracts";

export const metaverseProgressRowSchema = z.object({
  user_id: z.string().uuid(),
  world_id: z.string().min(1),
  recent_completion: metaverseRecentMissionCompletionSummarySchema,
  last_completed_mission: metaverseLastCompletedMissionMetadataSchema,
  updated_at: z.string().datetime(),
});

export type MetaverseProgressRow = z.infer<typeof metaverseProgressRowSchema>;

export function parseMetaverseProgressRow(input: unknown): MetaverseProgressRow {
  return metaverseProgressRowSchema.parse(input);
}

export function createResolvedMetaverseProgressSnapshotFromRow(args: {
  row: MetaverseProgressRow;
  source: MetaverseProgressSource;
}): MetaverseResolvedProgressSnapshot {
  const { row } = args;

  return createMetaverseProgressSnapshotFromMissionResult({
    payload: {
      version: 1,
      source: "mission-room",
      worldId: row.last_completed_mission.worldId,
      sessionId: row.last_completed_mission.sessionId,
      missionId: row.recent_completion.missionId,
      missionTitle: row.recent_completion.missionTitle,
      returnHubPath: row.recent_completion.returnHubPath,
      issuedAtIso: row.last_completed_mission.issuedAtIso,
      completedAtIso: row.recent_completion.completedAtIso,
      outcome: {
        status: "completed",
        label: row.last_completed_mission.outcomeLabel,
      },
      summary: {
        completionLabel: row.recent_completion.completionLabel,
        objectiveCount: row.recent_completion.objectiveCount,
        completedObjectives: row.recent_completion.completedObjectives,
        percentComplete: row.recent_completion.percentComplete,
        resultLabel: row.recent_completion.resultLabel,
        resultDetail: row.recent_completion.resultDetail,
      },
      rewards: {
        status: row.recent_completion.rewardSummary ? "placeholder" : "pending",
        summaryLabel: row.recent_completion.rewardSummary?.summaryLabel ?? "Reward summary kept replaceable",
        summaryDetail:
          row.recent_completion.rewardSummary?.summaryDetail ??
          "Reward summary details are still optional during snapshot hydration and can be upgraded later.",
        highlightedRewardLabel: row.recent_completion.rewardSummary?.highlightedRewardLabel ?? null,
        placeholderCount: row.recent_completion.rewardSummary?.placeholderCount ?? 0,
        inventoryUpdateCount: row.recent_completion.rewardSummary?.inventoryUpdateCount ?? 0,
        sourceLabel: "Persisted reward summary",
        fallbackLabel: "Persisted reward fallback remains replaceable",
      },
      integrations: {
        rewardHook: "pending",
        persistence: "persisted",
        reporting: "not-connected",
      },
    },
    persistenceStatus: "persisted",
    source: args.source,
  });
}
